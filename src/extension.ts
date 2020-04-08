import * as path from "path";
import * as vscode from "vscode";

import { getConfig } from "./config";
import {
  groupNameInputBoxOptions,
  commandNameInputBoxOptions,
  commandScriptInputBoxOptions,
  projectNameInputBoxOptions,
} from "./inputBoxOptions";
import { ProjectStorage, TerminalCommand } from "./storage";

const PROJECTS_FILE = `terminal-projects.json`;

const enum USER_OPTIONS {
  "ADD_COMMANDS" = "Add Commands",
  "CANCEL" = "CANCEL",
}

const enum DISPLAY_MESSAGE {
  "COMMANDS_SAVED" = "Commands saved!",
  "DEFINE_PROJECT_NAME" = "You must define a name for the project.",
  "PROJECT_ALREADY_EXISTS" = "Project already exists!",
  "COMMAND_ADDED" = "Command is successfully added, do you need to add More?",
}

// this method is called when your extension is activated
export const activate = (context: vscode.ExtensionContext) => {
  const configurations = getConfig();
  const projectStorage = new ProjectStorage(getProjectFilePath());

  vscode.commands.registerCommand(`terminalLauncher.saveProject`, () =>
    saveProject()
  );
  vscode.commands.registerCommand(`terminalLauncher.editProjects`, () =>
    editProjects()
  );
  vscode.commands.registerCommand(`terminalLauncher.runProject`, () =>
    runProject()
  );

  const saveProject = () => {
    const directoryProjectName = vscode.workspace.rootPath.substr(
      vscode.workspace.rootPath.lastIndexOf("/") + 1
    );
    const projectPath = vscode.workspace.rootPath;

    vscode.window
      .showInputBox(projectNameInputBoxOptions(directoryProjectName))
      .then(async (projectName) => {
        if (typeof projectName === "undefined") {
          return;
        }
        if (projectName.trim() === "") {
          vscode.window.showWarningMessage(DISPLAY_MESSAGE.DEFINE_PROJECT_NAME);
          return;
        }

        // everytime you add new commands you will always need to fill the group-name
        // whether this group-name exists or not the new command will over-ride the group-name

        if (!projectStorage.exists(projectName)) {
          projectStorage.addToProjectList(projectName, projectPath);
          await addNewCommands(projectName);
        } else {
          vscode.window
            .showInformationMessage(
              DISPLAY_MESSAGE.PROJECT_ALREADY_EXISTS,
              { title: USER_OPTIONS.ADD_COMMANDS },
              { title: USER_OPTIONS.CANCEL }
            )
            .then(async (option) => {
              // nothing selected
              if (typeof option === "undefined") {
                return;
              }

              switch (option.title) {
                // switch for future use case
                case USER_OPTIONS.ADD_COMMANDS: {
                  await addNewCommands(projectName);
                  return;
                }
              }
            });
        }
      });
  };

  function editProjects(): void {
    vscode.workspace.openTextDocument(getProjectFilePath()).then((document) => {
      vscode.window.showTextDocument(document);
    });
  }

  function getProjectFilePath(): string {
    let projectFile = "";
    const { projectsConfigurationsLocation } = configurations;

    if (!!projectsConfigurationsLocation) {
      projectFile = path.join(projectsConfigurationsLocation, PROJECTS_FILE);
    } else {
      const appdata =
        process.env.APPDATA ||
        (process.platform === "darwin"
          ? process.env.HOME + "/Library/Application Support"
          : "/var/local");
      projectFile = path.join(appdata, "Code", "User", PROJECTS_FILE);
    }

    return projectFile;
  }

  async function createTerminal(openNewTerminalWindow, terminal) {
    // for every first call i.e (terminal id = 0) there will be a new terminal window
    // and for all other cases a split will be made in the current active window

    let command = openNewTerminalWindow
      ? "workbench.action.terminal.split"
      : "workbench.action.terminal.newInActiveWorkspace";

    return new Promise(async (resolve) => {
      await vscode.commands.executeCommand(command).then(async () => {
        let listener = vscode.window.onDidOpenTerminal(
          async (terminalInstance) => {
            terminalInstance.show();
            await vscode.commands
              .executeCommand("workbench.action.terminal.renameWithArg", {
                name: terminal.name,
              })
              .then(async () => {
                terminalInstance.sendText(terminal.script, true);
                listener.dispose();
                resolve();
              });
          }
        );
      });
    });
  }

  async function runProject() {
    const workspacePath = vscode.workspace.rootPath;
    const project = projectStorage.existsWithRootPath(workspacePath);

    const { groups = {} } = project;

    const groupNames = Object.keys(groups);
    for (let groupIndex = 0; groupIndex < groupNames.length; groupIndex++) {
      let commands = groups[groupNames[groupIndex]];
      for (
        let commandIndex = 0;
        commandIndex < commands.length;
        commandIndex++
      ) {
        await createTerminal(commandIndex, commands[commandIndex]);
      }
    }
  }

  async function addNewCommands(projectName: string): Promise<boolean> {
    const inputCommands = [] as TerminalCommand[];
    const newGroupName = await getGroupName();

    do {
      const command: TerminalCommand = await getNewCommand();
      inputCommands.push(command);
    } while (await isDone());

    projectStorage.addCommands(projectName, newGroupName, inputCommands);
    projectStorage.save();

    vscode.window.showInformationMessage(DISPLAY_MESSAGE.COMMANDS_SAVED);
    return Promise.resolve(true);
  }

  async function getNewCommand(): Promise<TerminalCommand> {
    const commandName = await vscode.window.showInputBox(
      commandNameInputBoxOptions()
    );
    const commandScript = await vscode.window.showInputBox(
      commandScriptInputBoxOptions()
    );

    const command: TerminalCommand = {
      name: commandName,
      script: commandScript,
    };

    return Promise.resolve(command);
  }

  async function getGroupName(): Promise<string> {
    const groupName = await vscode.window.showInputBox(
      groupNameInputBoxOptions()
    );

    return Promise.resolve(groupName);
  }

  async function isDone(): Promise<boolean> {
    const selection = await vscode.window.showInformationMessage(
      DISPLAY_MESSAGE.COMMAND_ADDED,
      { title: "Yes" },
      { title: "No" }
    );

    if (selection && selection.title === `Yes`) {
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }
};

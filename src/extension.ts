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
  "ADD_PROJECT" = "Add Project",
  "EDIT_TERMINAL_PROJECT" = "Edit Terminal Project",
}

const enum DISPLAY_MESSAGE {
  "COMMANDS_SAVED" = "Commands saved!",
  "DEFINE_PROJECT_NAME" = "You must define a name for the project.",
  "PROJECT_ALREADY_EXISTS" = "Project already exists!",
  "COMMAND_ADDED" = "Command is successfully added, do you need to add More?",
  "NO_PROJECT_FOUND" = "No Confiugration found for current project.",
  "WRONG_JSON" = "Not a valid json file. (Add {} if is empty)",
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

  // registering command first because activate is only called once
  // and after registration doing error checks for the JSON file
  const errorLoading = projectStorage.load();
  if (errorLoading) {
    handleErrors();
    return;
  }

  const saveProject = () => {
    // reloading the project list before saving a new project
    const errorLoading = projectStorage.reload();
    if (errorLoading) {
      handleErrors();
      return;
    }

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

                default:
                  return;
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
    // reloadng project list before  running project
    const errorLoading = projectStorage.reload();
    if (errorLoading) {
      handleErrors();
      return;
    }

    const workspacePath = vscode.workspace.rootPath;
    const project = projectStorage.existsWithRootPath(workspacePath);

    if (!project) {
      const selection = await vscode.window.showInformationMessage(
        DISPLAY_MESSAGE.NO_PROJECT_FOUND,
        { title: USER_OPTIONS.ADD_PROJECT },
        { title: USER_OPTIONS.CANCEL }
      );

      if (!selection) {
        return;
      }

      switch (selection.title) {
        case USER_OPTIONS.ADD_PROJECT: {
          saveProject();
          return;
        }
        default:
          return;
      }
    }

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

    if (!newGroupName) {
      return;
    }

    do {
      const command: TerminalCommand = await getNewCommand();
      // user is no longer intersted in pushing new commands, hence break the loop
      if (!!command) {
        inputCommands.push(command);
      } else {
        break;
      }
    } while (await isDone());

    if (inputCommands.length > 0) {
      projectStorage.addCommands(projectName, newGroupName, inputCommands);
      projectStorage.save();
      vscode.window.showInformationMessage(DISPLAY_MESSAGE.COMMANDS_SAVED);
    }
    return Promise.resolve(true);
  }

  async function getNewCommand(): Promise<TerminalCommand> {
    const commandName = await vscode.window.showInputBox(
      commandNameInputBoxOptions()
    );
    const commandScript = await vscode.window.showInputBox(
      commandScriptInputBoxOptions()
    );

    // this check is when user has cancelled the inputBox
    if (!commandName || !commandScript) {
      return Promise.resolve(undefined);
    }

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

  async function handleErrors() {
    const selection = await vscode.window.showInformationMessage(
      DISPLAY_MESSAGE.WRONG_JSON,
      { title: USER_OPTIONS.EDIT_TERMINAL_PROJECT },
      { title: USER_OPTIONS.CANCEL }
    );

    if (selection && selection.title === USER_OPTIONS.EDIT_TERMINAL_PROJECT) {
      editProjects();
    }
  }
};

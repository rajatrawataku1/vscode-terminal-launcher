import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

import { Config, getConfig } from "./config";
import {
  groupNameInputBoxOptions,
  commandNameInputBoxOptions,
  commandScriptInputBoxOptions,
  projectNameInputBoxOptions,
} from "./inputBoxOptions";
import { Project, ProjectStorage, TerminalCommand } from "./storage";
import { create } from "domain";

const homeDir = os.homedir();
const PROJECTS_FILE = `terminal-projects.json`;

const enum USER_OPTIONS {
  "ADD_COMMANDS" = "Add Commands",
  "ADD_GROUP" = "Add Group",
  "CANCEL" = "CANCEL",
}
// this method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
  const configurations: Config = getConfig();
  const projectStorage: ProjectStorage = new ProjectStorage(
    getProjectFilePath()
  );
  const errorLoading: string = projectStorage.load();

  vscode.commands.registerCommand(`terminalLauncher.saveProject`, () =>
    saveProject()
  );
  vscode.commands.registerCommand(`terminalLauncher.editProjects`, () =>
    editProjects()
  );
  vscode.commands.registerCommand(`terminalLauncher.runProject`, () =>
    runProject()
  );

  function saveProject(): void {
    const projectName = vscode.workspace.rootPath.substr(
      vscode.workspace.rootPath.lastIndexOf("/") + 1
    );
    const projectPath = vscode.workspace.rootPath;

    vscode.window
      .showInputBox(projectNameInputBoxOptions(projectName))
      .then(async (_projectName) => {
        if (typeof _projectName === "undefined") {
          return;
        }
        if (_projectName === "") {
          vscode.window.showWarningMessage(
            "You must define a name for the project."
          );
          return;
        }

        if (!projectStorage.exists(_projectName)) {
          projectStorage.addToProjectList(_projectName, projectPath);
          await addNewCommands(_projectName);
        } else {
          const optionAddCommand = {
            title: USER_OPTIONS.ADD_COMMANDS,
          } as vscode.MessageItem;
          const optionCancel = {
            title: USER_OPTIONS.CANCEL,
          } as vscode.MessageItem;

          vscode.window
            .showInformationMessage(
              "Project already exists!",
              optionAddCommand,
              optionCancel
            )
            .then(async (option) => {
              // nothing selected
              if (typeof option === "undefined") {
                return;
              }

              switch (option.title) {
                case USER_OPTIONS.ADD_COMMANDS: {
                  await addNewCommands(_projectName);
                  return;
                }
              }
            });
        }
      });
  }

  function editProjects(): void {
    vscode.workspace.openTextDocument(getProjectFilePath()).then((document) => {
      vscode.window.showTextDocument(document);
    });
  }

  function getProjectFilePath(): string {
    let projectFile: string;
    const projectsConfigurationsLocation: string =
      configurations.projectsConfigurationsLocation;

    if (projectsConfigurationsLocation !== "") {
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
                console.log(openNewTerminalWindow);
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
    const project: Project = projectStorage.existsWithRootPath(workspacePath);

    const { groups = {} } = project;

    const groupNames = Object.keys(groups);
    for (let i = 0; i < groupNames.length; i++) {
      let commands = groups[groupNames[i]];
      for (let j = 0; j < commands.length; j++) {
        await createTerminal(j, commands[j]);
      }
    }
  }

  async function addNewCommands(projectName: string): Promise<boolean> {
    const commands: TerminalCommand[] = [];
    const _newGroupName = await getGroupName();
    do {
      const __command: TerminalCommand = await getNewCommand();
      commands.push(__command);
    } while (await isDone());

    projectStorage.addCommands(projectName, _newGroupName, commands);

    projectStorage.save();
    vscode.window.showInformationMessage("Commands saved!");
    return Promise.resolve(true);
  }

  async function getNewCommand(): Promise<TerminalCommand> {
    const _commandName = await vscode.window.showInputBox(
      commandNameInputBoxOptions()
    );
    const _commandScript = await vscode.window.showInputBox(
      commandScriptInputBoxOptions()
    );

    const _command: TerminalCommand = {
      name: _commandName,
      script: _commandScript,
    };

    return Promise.resolve(_command);
  }

  async function addNewGroup(projectName: string): Promise<string> {
    const _groupName = await getGroupName();
    projectStorage.addGroup(projectName, _groupName);

    projectStorage.save();
    vscode.window.showInformationMessage("Group saved!");
    return Promise.resolve(_groupName);
  }

  async function getGroupName(): Promise<string> {
    const _groupName = await vscode.window.showInputBox(
      groupNameInputBoxOptions()
    );

    return Promise.resolve(_groupName);
  }

  async function isDone(): Promise<boolean> {
    const optionYes = {
      title: "Yes",
    } as vscode.MessageItem;
    const optionNo = {
      title: "No",
    } as vscode.MessageItem;

    const selection = await vscode.window.showInformationMessage(
      `command is successfully added, do you need to add More?`,
      optionYes,
      optionNo
    );

    if (selection.title === `Yes`) {
      return Promise.resolve(true);
    } else {
      return Promise.resolve(false);
    }
  }
}

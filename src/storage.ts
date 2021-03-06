import fs = require("fs");
import { Utils } from './utils';

const utils_obj = new Utils();

export interface TerminalCommand {
  name: string;
  script: string;
};

export interface Project {
  name: string;
  root_path: string;
  commands: TerminalCommand[];
};

export interface ProjectList extends Array < Project > {};

class ProjectItem implements Project {

  public name: string;
  public root_path: string;
  public commands: TerminalCommand[];

  constructor(project_name: string, project_root_path: string, terminal_commands: TerminalCommand[]) {
    this.name = project_name;
    this.root_path = project_root_path;
    this.commands = terminal_commands;
  }
}

export class ProjectStorage {

  private projectList: ProjectList;
  private filename: string;

  constructor(filename: string) {
    this.filename = filename;
    this.projectList = [] as ProjectList;
  }

  public addToProjectList(project_name: string, root_path: string, command: TerminalCommand[]): void {    
    this.projectList.push(new ProjectItem(project_name, root_path, command));
    return;
  }

  public removeFormProjectList(project_name: string): Project {

    const index = utils_obj.getIndexWherePropertyIs(this.projectList, `name`, project_name);
    return this.projectList.splice(index, 1)[0];
  }

  public addCommands(project_name: string, commands: TerminalCommand[]): void {
    const index = utils_obj.getIndexWherePropertyIs(this.projectList, `name`, project_name);

    this.projectList[index].commands = [...commands];
  }

  public removeCommand(project_name: string, command_name: string): void {
    const project_index = utils_obj.getIndexWherePropertyIs(this.projectList, `name`, project_name);
    const command_index = utils_obj.getIndexWherePropertyIs(this.projectList[project_index].commands, `name`, command_name)

    this.projectList[project_index].commands.splice(command_index, 1);
    return;
  }

  public updateRootPath(project_name: string, path: string): void {
    const index = utils_obj.getIndexWherePropertyIs(this.projectList, `name`, project_name);

    this.projectList[index].root_path = path;
  }

  public exists(project_name: string): boolean {
    let found: boolean = false;
    
    const index = utils_obj.getIndexWherePropertyIs(this.projectList, `name`, project_name);

    if (index > -1 ) {
      found = true;
    }
    return found;
  }

  public existsWithRootPath(root_path: string): Project {
    const index = utils_obj.getIndexWherePropertyIs(this.projectList, `root_path`, root_path);

    return this.projectList[index];
  }

  public length(): number {
    return this.projectList.length;
  }

  public load(): string {
    let items = [];

    // missing file (new install)
    if (!fs.existsSync(this.filename)) {
      this.projectList = items as ProjectList;
      return "";
    }

    try {
      items = JSON.parse(fs.readFileSync(this.filename).toString());
      this.projectList = items as ProjectList;

      return "";
    } catch (error) {
      return error.toString();
    }
  }

  public reload() {
    const items = [];

    // missing file (new install)
    if (!fs.existsSync(this.filename)) {
      this.projectList = items as ProjectList;
    } else {
      this.load();
    }
  }

  public save() {
    fs.writeFileSync(this.filename, JSON.stringify(this.projectList, null, "\t"));
  }

  public map(): any {
    const newItems = this.projectList.map(item => {
      return {
        label: item.name,
        description: item.root_path
      };
    });
    return newItems;
  }
}
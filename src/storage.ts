import fs = require("fs");
import { Utils } from "./utils";

const utils_obj = new Utils();

export interface TerminalCommand {
  name: string;
  script: string;
}

export type Group = Record<string, TerminalCommand[]>;

export interface Project {
  name: string;
  root_path: string;
  groups: Group;
}

export interface ProjectList extends Array<Project> {}

class ProjectItem implements Project {
  public name: string;
  public root_path: string;
  public groups: Group;

  constructor(
    project_name: string,
    project_root_path: string,
    groups: Group = {} as Group
  ) {
    this.name = project_name;
    this.root_path = project_root_path;
    this.groups = groups;
  }
}

export class ProjectStorage {
  private projectList: ProjectList;
  private filename: string;

  constructor(filename: string) {
    this.filename = filename;
    this.projectList = [] as ProjectList;
  }

  // adding project
  public addToProjectList(project_name: string, root_path: string): void {
    this.projectList.push(new ProjectItem(project_name, root_path));
    return;
  }

  // removing project

  public removeFormProjectList(project_name: string): Project {
    const index = utils_obj.getIndexWherePropertyIs(
      this.projectList,
      `name`,
      project_name
    );
    return this.projectList.splice(index, 1)[0];
  }

  // adding group
  public addGroup(project_name: string, groupName: string) {
    const index = utils_obj.getIndexWherePropertyIs(
      this.projectList,
      `name`,
      project_name
    );

    return (this.projectList[index].groups[groupName] = []);
  }

  // deleting group
  public removeGroup(project_name: string, groupName: string) {
    const index = utils_obj.getIndexWherePropertyIs(
      this.projectList,
      `name`,
      project_name
    );

    const deletedGroup = { ...this.projectList[index].groups[groupName] };
    delete this.projectList[index].groups[groupName];
    return deletedGroup;
  }

  // adding command
  public addCommands(
    project_name: string,
    groupName: string,
    commands: TerminalCommand[]
  ): void {
    const index = utils_obj.getIndexWherePropertyIs(
      this.projectList,
      `name`,
      project_name
    );

    this.projectList[index].groups[groupName] = commands;
  }

  // removing command
  public removeCommand(
    project_name: string,
    groupName: string,
    command_name: string
  ): void {
    const project_index = utils_obj.getIndexWherePropertyIs(
      this.projectList,
      `name`,
      project_name
    );
    const command_index = utils_obj.getIndexWherePropertyIs(
      this.projectList[project_index].groups[groupName],
      `name`,
      command_name
    );

    this.projectList[project_index].groups[groupName].splice(command_index, 1);
    return;
  }

  public updateRootPath(project_name: string, path: string): void {
    const index = utils_obj.getIndexWherePropertyIs(
      this.projectList,
      `name`,
      project_name
    );

    this.projectList[index].root_path = path;
  }

  public exists(project_name: string): boolean {
    let found: boolean = false;

    const index = utils_obj.getIndexWherePropertyIs(
      this.projectList,
      `name`,
      project_name
    );

    if (index > -1) {
      found = true;
    }
    return found;
  }

  public existsWithRootPath(root_path: string): Project {
    const index = utils_obj.getIndexWherePropertyIs(
      this.projectList,
      `root_path`,
      root_path
    );

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
    fs.writeFileSync(
      this.filename,
      JSON.stringify(this.projectList, null, "\t")
    );
  }

  public map(): any {
    const newItems = this.projectList.map((item) => {
      return {
        label: item.name,
        description: item.root_path,
      };
    });
    return newItems;
  }
}

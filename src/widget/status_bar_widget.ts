import * as vscode from "vscode";

/**
 * `StatusBarWidget` is a class designed to manage a widget in the Visual Studio Code status bar.
 * It encapsulates the functionality to create, show, hide, update, and dispose a status bar item.
 */
class StatusBarWidget {
  /**
   * Represents the status bar item instance from the Visual Studio Code API.
   */
  private item: vscode.StatusBarItem;

  /**
   * The name of the widget, used internally for identification and display purposes.
   */
  private name: string;

  /**
   * The content displayed by the status bar item. Initially set to "Widget: " followed by the widget's name.
   */
  private content: string;

  /**
   * Constructs a new instance of the StatusBarWidget.
   * @param name The name of the widget, used for identification and initial content.
   * @param alignment Determines the alignment of the item in the status bar (left or right).
   * @param priority The priority of the item which influences its order in the status bar.
   */
  constructor(
    name: string,
    alignment: vscode.StatusBarAlignment,
    priority: number
  ) {
    this.name = name;
    this.content = "Widget: " + name;
    this.item = vscode.window.createStatusBarItem(alignment, priority);
    this.item.text = this.content;
  }

  /**
   * Shows the status bar item in the Visual Studio Code status bar.
   */
  public show(): void {
    this.item.show();
  }

  /**
   * Hides the status bar item from the Visual Studio Code status bar.
   */
  public hide(): void {
    this.item.hide();
  }

  /**
   * Updates the content displayed by the status bar item.
   * @param content The new content to be displayed.
   */
  public updateContent(content: string): void {
    this.content = content;
    this.item.text = this.content;
  }

  /**
   * Disposes the status bar item, removing it from the status bar and freeing up resources.
   */
  public dispose(): void {
    this.item.dispose();
  }
}

class StatusBarWidgetManager {
  /**
   * Represents the instance of the StatusBarWidgetManager class.
   */
  private static instance?: StatusBarWidgetManager = undefined;
  /**
   * Represents a collection of StatusBarWidget instances.
   */
  private widgets: Map<string, StatusBarWidget>;

  /**
   * Represents a StatusBarWidget.
   */
  private constructor() {
    this.widgets = new Map<string, StatusBarWidget>();
  }

  /**
   * Returns the singleton instance of the StatusBarWidgetManager.
   * If the instance does not exist, it creates a new instance and returns it.
   * @returns The singleton instance of the StatusBarWidgetManager.
   */
  public static getInstance(): StatusBarWidgetManager {
    if (!StatusBarWidgetManager.instance) {
      StatusBarWidgetManager.instance = new StatusBarWidgetManager();
    }
    return StatusBarWidgetManager.instance;
  }

  /**
   * Retrieves a StatusBarWidget with the specified name.
   * If the widget does not exist, it creates a new one and adds it to the StatusBar.
   *
   * @param name - The name of the widget to retrieve.
   * @returns The StatusBarWidget with the specified name.
   */
  public getWidget(name: string): StatusBarWidget {
    if (!this.widgets.has(name)) {
      this.createWidget(name, vscode.StatusBarAlignment.Left, 0);
    }
    return this.widgets.get(name) as StatusBarWidget;
  }

  /**
   * Removes a widget from the status bar.
   * @param name - The name of the widget to remove.
   */
  public removeWidget(name: string): void {
    const widget = this.widgets.get(name);
    if (widget) {
      widget.dispose();
      this.widgets.delete(name);
    }
  }

  /**
   * Disposes all the widgets in the status bar widget.
   */
  public disposeAll(): void {
    this.widgets.forEach((widget) => widget.dispose());
    this.widgets.clear();
  }

  /**
   * Creates a new status bar widget with the specified name, alignment, and priority.
   * @param name - The name of the widget.
   * @param alignment - The alignment of the widget in the status bar.
   * @param priority - The priority of the widget in relation to other widgets.
   */
  private createWidget(
    name: string,
    alignment: vscode.StatusBarAlignment,
    priority: number
  ): void {
    const widget = new StatusBarWidget(name, alignment, priority);
    this.widgets.set(name, widget);
    widget.show();
  }
}

/**
 * The manager for the status bar widget.
 * Acts as a proxy for the `StatusBarWidgetManager` instance and provides additional functionality.
 */
export const statusBarWidgetManager = new Proxy(
  StatusBarWidgetManager.getInstance(),
  {
    get(target, prop, receiver) {
      if (typeof prop === "string" && !Reflect.has(target, prop)) {
        return target.getWidget(prop);
      }
      return Reflect.get(target, prop, receiver);
    },
  }
);

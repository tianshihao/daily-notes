import type IDisposable from "../idisposable";
import * as vscode from "vscode";
import { IConfigurationKeyTypeMap } from "./model";

export interface IConfigurationService<M> extends IDisposable {
  get<K extends keyof M>(key: K, scope?: vscode.ConfigurationScope): M[K];

  getByAbsolute<T>(
    section: string,
    scope?: vscode.ConfigurationScope
  ): T | undefined;
}

/**
 * Represents a configuration manager that implements the
 * `IConfigurationService` interface. Provides methods to retrieve
 * configuration values.
 *
 * @template M - The type of the configuration model.
 */
class ConfigurationManager<M> implements IConfigurationService<M> {
  /**
   * Disposes the configuration manager.
   */
  public dispose(): void {}

  /**
   * Gets the value of a configuration key.
   *
   * @template K - The type of the configuration key.
   * @param key - The configuration key.
   * @param scope - The configuration scope.
   * @returns The value of the configuration key.
   */
  public get<K extends keyof M>(
    key: K,
    scope?: vscode.ConfigurationScope
  ): M[K] {
    return vscode.workspace
      .getConfiguration("dailyNotes", scope)
      .get<M[K]>(key as string)!;
  }

  public update<K extends keyof M>(
    key: K,
    value: M[K],
    target?: vscode.ConfigurationTarget
  ) {
    // return vscode.workspace
    //   .getConfiguration("dailyNotes", scope)
    //   .update(key as string, value);
    return vscode.workspace
      .getConfiguration("dailyNotes")
      .update(key as string, value, target);
  }

  /**
   * Gets the value of a configuration section by its absolute path.
   *
   * @template T - The type of the configuration section.
   * @param section - The absolute path of the configuration section.
   * @param scope - The configuration scope.
   * @returns The value of the configuration section.
   */
  public getByAbsolute<T>(
    section: string,
    scope?: vscode.ConfigurationScope
  ): T | undefined {
    if (section.startsWith("dailyNotes")) {
      return this.get(section.slice() as any, scope) as any;
    } else {
      return vscode.workspace
        .getConfiguration(undefined, scope)
        .get<T>(section);
    }
  }
}

export const configManager =
  new ConfigurationManager<IConfigurationKeyTypeMap>();

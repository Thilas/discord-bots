import fs from "fs";
import path from "path";
import appConfig from "./app.json";

export const configName = process.env.NODE_ENV || "development";

/** Global config. */
export const app = load("app.json", appConfig);

function getConfigMetadata(filename: string) {
  const name = path.join("config", configName, filename);
  const file = path.resolve(__dirname, name);
  const overridden = fs.existsSync(file);
  return { overridden, file, name };
}

/**
 * Loads the config file `filename`
 * using a possible overriden file if it exists
 * (i.e `NODE_ENV`/`filename`).
 * @param filename File name of the config file.
 * @param config Content of the main config file.
 * @returns The relevant config.
 */
export function load<T>(filename: string, config: T) {
  return loadConfig(filename, config);
}

/**
 * Loads the config file `filename` and watches it for changes,
 * using a possible overriden file if it exists
 * (i.e `NODE_ENV`/`filename`).
 * @param filename File name of the config file.
 * @param config Content of the main config file.
 * @param apply Callback to apply changes of the config file.
 * @returns The relevant config.
 */
export function loadAndWatch<T>(
  filename: string,
  config: T,
  apply: (config: T) => void
) {
  const configMetadata = getConfigMetadata(filename);
  let timeout: NodeJS.Timeout | undefined;
  fs.watch(configMetadata.file, (event) => {
    if (event === "change" && !timeout) {
      timeout = setTimeout(() => (timeout = undefined), 1000); // give 1 second for multiple events
      fs.readFile(configMetadata.file, (err, data) => {
        if (err) {
          console.error(`Error while reading ${filename}: ${err}`);
        }
        if (data.length) {
          console.log(`** Refreshing ${filename}...`);
          try {
            config = JSON.parse(data.toString());
            try {
              apply(config);
            } catch (error) {
              console.error(`Error while applying ${filename}: ${error}`);
            }
          } catch (error) {
            console.error(`Error while parsing ${filename}: ${error}`);
          }
        }
      });
    }
  });
  config = loadConfig(filename, config, configMetadata);
  apply(config);
  return config;
}

function loadConfig<T>(
  filename: string,
  config: T,
  configMetadata = getConfigMetadata(filename)
) {
  console.log(`** Loading ${filename} from ${configMetadata.file}...`);
  if (!configMetadata.overridden) {
    throw `Missing configuration file: ${configMetadata.name}`;
  }
  const data = fs.readFileSync(configMetadata.file);
  config = JSON.parse(data.toString());
  return config;
}

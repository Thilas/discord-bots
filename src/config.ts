import fs from 'fs';
import path from 'path';
import appConfig from './config/app.json';

const configName = process.env.NODE_ENV || 'development';

export const app = load('app.json', appConfig);

function getConfigMetadata(filename: string) {
  let file = path.resolve(__dirname, 'config', configName, filename);
  let overridden = fs.existsSync(file);
  if (!overridden) {
    file = path.resolve(__dirname, 'config', filename);
  }
  return { overridden, file };
}

export function load<T>(filename: string, config: T) {
  return loadConfig(filename, config);
}

export function loadAndwatch<T>(filename: string, config: T, apply: (config: T) => void) {
  let configMetadata = getConfigMetadata(filename);
  fs.watch(configMetadata.file, event => {
    if (event === 'change') {
      fs.readFile(configMetadata.file, (err, data) => {
        if (err) {
          console.error(`Error while reading ${filename}: ${err}`);
        }
        if (data.length) {
          console.log(`Refreshing ${filename}...`);
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

function loadConfig<T>(filename: string, config: T, configMetadata = getConfigMetadata(filename)) {
  console.log(`Loading ${filename} from ${configMetadata.file}...`);
  if (!configMetadata.overridden) {
    return config;
  }
  let data = fs.readFileSync(configMetadata.file);
  config = JSON.parse(data.toString());
  return config;
}

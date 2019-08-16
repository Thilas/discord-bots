import fs from 'fs';
import path from 'path';
import appDevelopment from './config/app.development.json';
import appProduction from './config/app.production.json';

const production = process.env.NODE_ENV === 'production';

export const app = production ? appProduction : appDevelopment;

export function watch<TIn, TOut>(filename: string, data: TIn, callback: (json: TIn) => TOut, assign: (data: TOut) => void) {
  let file = path.resolve(__dirname, 'config', filename);
  fs.watch(file, event => {
    if (event === 'change') {
      fs.readFile(file, (err, data) => {
        if (err) {
          console.error(`Error while reading ${filename}: ${err}`);
        }
        if (data.length) {
          console.log(`Refreshing ${filename}...`);
          try {
            let json = JSON.parse(data.toString());
            try {
              let out = callback(json);
              try {
                assign(out);
              } catch (error) {
                console.error(`Error while assigning ${filename}: ${error}`);
              }
            } catch (error) {
              console.error(`Error while loading ${filename}: ${error}`);
            }
          } catch (error) {
            console.error(`Error while parsing ${filename}: ${error}`);
          }
        }
      });
    }
  });
  return callback(data);
}

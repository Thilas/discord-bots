import appDevelopment from './config/app.development.json';
import appProduction from './config/app.production.json';
import fs from 'fs';
import path from 'path';

const PRODUCTION = process.env.NODE_ENV === 'production';

export const APP = PRODUCTION ? appProduction : appDevelopment;

export function watch<TIn, TOut>(filename: string, data: TIn, callback: (data: TIn) => TOut) {
  let file = path.resolve(__dirname, 'config', filename);
  fs.watch(file, event => {
    if (event === 'change') {
      fs.readFile(file, (err, data) => {
        if (err) {
          console.error(`Error while reading ${filename}: ${err}`);
        }
        if (data.length) {
          console.log(`Refreshing ${filename}...`);
          callback(JSON.parse(data.toString()));
        }
      });
    }
  });
  return callback(data);
}

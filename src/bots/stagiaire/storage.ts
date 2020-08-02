import fs from "fs";
import path from "path";
import { configName } from "../../config";
import { Items } from "./items";

export interface Storage {
  players: Players;
}

export interface Players {
  [player: string]: Player;
}

export interface Player {
  [perso: string]: Character;
}

export interface Character {
  transactions: Transaction[];
}

export interface Transaction {
  id: string;
  roll: number;
  bonus: number;
  requestDate: Date;
  receiptDate: Date;
  kind: Items;
  name: string;
  quantity: number;
  toBeStored: boolean;
  received?: boolean;
  storedInInventory?: boolean;
}

function getStorageFile() {
  const file = path.resolve(__dirname, "..", "..", "config", configName, "storage.json");
  const exists = fs.existsSync(file);
  return { path: file, exists };
}

export function getStorage() {
  const file = getStorageFile();
  if (!file.exists) return;
  const data = fs.readFileSync(file.path);
  const storage: Storage = JSON.parse(data.toString());
  return storage;
}

export function setStorage(storage: Storage) {
  const file = getStorageFile();
  const data = JSON.stringify(storage);
  fs.writeFileSync(file.path, data);
}

import * as migration_20261003_154219_initial_content from "./20261003_154219_initial_content";

export const migrations = [
  {
    up: migration_20261003_154219_initial_content.up,
    down: migration_20261003_154219_initial_content.down,
    name: "20261003_154219_initial_content",
  },
];

# indexation / const

Exported constants: values, arrays, records and objects.

## array

| entity                     | family                                                              | description                                    |
| -------------------------- | ------------------------------------------------------------------- | ---------------------------------------------- |
| `NON_EXPORTED_TS_SUFFIXES` | [non-exported-ts-suffixes](array/non-exported-ts-suffixes/index.ts) | TS files that are analyzed but never exported. |

## object

| entity                      | family                                                                 | description                                                 |
| --------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| `DEFAULT_INDEXATION_CONFIG` | [default-indexation-config](object/default-indexation-config/index.ts) | Settings used when the configuration file leaves a key out. |

## value

| entity                | family                                                    | description                                                  |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| `CONFIG_FILE_NAME`    | [config-file-name](value/config-file-name/index.ts)       | Configuration file looked up in the launch directory.        |
| `DRY_RUN_ENV`         | [dry-run-env](value/dry-run-env/index.ts)                 | Environment variable that disables barrel writes.            |
| `EXCLUDE_MODULES_ENV` | [exclude-modules-env](value/exclude-modules-env/index.ts) | Environment variable with excluded modules.json entries.     |
| `MODULES_ENV`         | [modules-env](value/modules-env/index.ts)                 | Environment variable with the selected modules.json entries. |

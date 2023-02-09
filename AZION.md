# Azion Graphql
Package version to run in Azion Cells (edge runtime).

## Build
```
npm ci
npm run pack:azion
```
Now you can use `graphql-azion-15.8.0.tgz` file in package.json.
Ex.: 
```
  "dependencies": {
    ...
    "graphql-azion": "file:PATH_TO_FILE_DIR/graphql-azion-15.8.0.tgz"
    ...
  },
```
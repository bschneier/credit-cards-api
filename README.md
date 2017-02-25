This API serves a credit cards web front end and connects to a mongo db instance and
redis cache. Github repositories for the web front end and mongo db schema are listed below.

Web front end: TODO
Mongo instance: TODO

In order to run the API, run the commands below. Upon startup, the API will look
for a text file containing two encryption keys. One will be used to decrypt the mongo
db password that will be used to connect to the mongo back end. The other key will
be used to create JSON web tokens used by the API for authentication. The name and
location of this file can be set in ./config/default.json. After reading the encryption
keys from the text file, the API will delete the file. So that file will have to be
restaged each time the API is redeployed or restarted. The API uses the simple-encryptor
npm package to encrypt and decrypt the mongo db password stored in the config file.

npm install -g nsp
npm install
npm start
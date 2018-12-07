#!/usr/bin/env node

const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
const ini = require('ini');
const AWS = require('aws-sdk');

const argv = require('yargs')
  .option('profile', {
    alias: 'p',
    default: process.env.AWS_PROFILE || 'dev',
    describe: 'Seed profile',
    type: 'string'
  })
  .option('token', {
    alias: 't',
    describe: 'MFA token',
    type: 'string'
  })
  .help()
  .argv;

const getCredentialsFileName = () => {
  const HOME = process.env.HOME || process.env.USERPROFILE || ((process.env.HOMEDRIVE || 'C:') + process.env.HOMEPATH);
  return join(HOME, '.aws/credentials');
};

const readCredentials = () => {
  const credentialsFile = getCredentialsFileName();
  return ini.parse(readFileSync(credentialsFile, 'utf-8'));
};

const getSessionToken = (profile, creds, token) => {
  AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: profile });
  // AWS.config.logger = process.stdout;

  const mfaArn = creds[profile].mfa_arn;

  const params = {
    DurationSeconds: 43200, // 12 hours
    SerialNumber: mfaArn,
    TokenCode: token,
  };

  const STS = new AWS.STS()
  return STS.getSessionToken(params).promise()
    .then((data) => {
      const { AccessKeyId, SecretAccessKey, SessionToken, Expiration } = data.Credentials;
      console.log('Expiration: ', Expiration);
      return {
        aws_access_key_id: AccessKeyId,
        aws_secret_access_key: SecretAccessKey,
        aws_session_token: SessionToken
      };
    });
};

const writeCredentials = (creds) => (data) => {
  delete creds.default;
  creds.default = data;
  writeFileSync(getCredentialsFileName(), ini.stringify(creds))
};

const run = (argv) => {
  console.log('args: %j', argv);

  const { profile, token } = argv;

  const creds = readCredentials();

  return (
    token ?
      getSessionToken(profile, creds, token) :
      Promise.resolve(creds[profile])
  )
    .then(writeCredentials(creds));
};

run(argv).catch(err => {
  console.error(err.message)
  process.exit(1)
});

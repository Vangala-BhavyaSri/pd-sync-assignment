# pd-sync-assignment
# Pipedrive Data Synchronization Assignment

## Overview

This project implements a TypeScript-based synchronization system between
input data and Pipedrive Person records.

The implementation dynamically maps fields from `inputData.json` using
the mappings defined in `mappings.json`.

## Functionality

The `syncPdPerson()` function performs the following steps:

1. Reads the person data from `inputData.json`.
2. Reads field mappings from `mappings.json`.
3. Dynamically resolves input fields, including nested paths such as
   `phoneNumber.home`.
4. Builds a Pipedrive Person payload.
5. Identifies the input field mapped to Pipedrive's `name` field.
6. Searches Pipedrive for an existing person using that name.
7. If a matching person exists, updates that person.
8. If no matching person exists, creates a new person.
9. Returns the created or updated Pipedrive Person.

## Example Mapping

```json
[
  {
    "pipedriveKey": "name",
    "inputKey": "fullName"
  },
  {
    "pipedriveKey": "email",
    "inputKey": "emailAdress"
  },
  {
    "pipedriveKey": "phone",
    "inputKey": "phoneNumber.home"
  }
]

## For Example

```text
fullName          -> name
emailAdress       -> email
phoneNumber.home  -> phone

## Edge Cases Handled

### 1. Missing or Empty Input Values

If a mapped value is `undefined`, `null`, or an empty string, the field is
skipped instead of sending invalid data to Pipedrive.

This prevents invalid or incomplete values from being sent to the API.

### 2. Multiple People With the Same Name

The person is searched using the field mapped to `name`.

If multiple people with the same name are found, synchronization is stopped
instead of arbitrarily updating one person.

This prevents accidentally updating the wrong Pipedrive contact.

### 3. API and Configuration Errors

The application checks whether `PIPEDRIVE_API_KEY` and
`PIPEDRIVE_COMPANY_DOMAIN` are configured.

Pipedrive API errors, HTTP failures, and network errors are handled with
meaningful error messages so that synchronization does not fail silently.

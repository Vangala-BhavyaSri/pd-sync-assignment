# Pipedrive Data Synchronization Assignment

## Overview

This project implements a TypeScript-based synchronization system between input data and Pipedrive Person records.

The implementation dynamically maps fields from `inputData.json` using the mappings defined in `mappings.json`.

## Functionality

The `syncPdPerson()` function performs the following steps:

1. Reads person data from `inputData.json`.
2. Reads field mappings from `mappings.json`.
3. Dynamically resolves input fields, including nested paths such as `phoneNumber.home`.
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



## Edge Cases
1. Missing Mapped Input Field

If a mapped input path does not exist or its value is null or undefined, the field is skipped and a warning is logged.

2. Missing or Empty Person Name

If the field mapped to name is missing or empty, synchronization stops with a validation error because the name is required to search for an existing person.

3. Multiple Persons With the Same Name

If multiple exact matches are found in Pipedrive, the application logs a warning and uses the first matching person to ensure deterministic behavior.

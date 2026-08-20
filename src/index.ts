import dotenv from "dotenv";
import type { PipedrivePerson } from "./types/pipedrive";
import inputData from "./mappings/inputData.json";
import mappings from "./mappings/mappings.json";

dotenv.config();

const apiKey = process.env.PIPEDRIVE_API_KEY;
const companyDomain = process.env.PIPEDRIVE_COMPANY_DOMAIN;

// --------------------------------------------------
// Types
// --------------------------------------------------

interface Mapping {
  pipedriveKey: string;
  inputKey: string;
}

interface InputData {
  [key: string]: unknown;
}

interface PipedriveApiResponse<T> {
  success: boolean;
  data: T;
}

interface PipedriveContactField {
  value: string;
  primary: boolean;
  label: string;
}

interface PipedrivePersonPayload {
  [key: string]: unknown;
  name?: string;
  emails?: PipedriveContactField[];
  phones?: PipedriveContactField[];
}

/*
 * IMPORTANT:
 *
 * Pipedrive person search does not return a PipedrivePerson
 * directly inside items.
 *
 * Search results contain an "item" property.
 */
interface PipedriveSearchItem {
  result_score: number;
  item: PipedrivePerson;
}

interface PipedriveSearchResponse {
  items: PipedriveSearchItem[];
}

// --------------------------------------------------
// Get nested value from inputData
// --------------------------------------------------

/**
 * Example:
 *
 * getValueByPath(inputData, "phoneNumber.home")
 *
 * returns:
 *
 * "123-456-7890"
 */
const getValueByPath = (
  object: InputData,
  path: string
): unknown => {
  return path.split(".").reduce<unknown>(
    (currentValue, key) => {
      if (
        currentValue !== null &&
        typeof currentValue === "object" &&
        key in currentValue
      ) {
        return (
          currentValue as Record<string, unknown>
        )[key];
      }

      return undefined;
    },
    object
  );
};

// --------------------------------------------------
// Pipedrive API request helper
// --------------------------------------------------

const pipedriveRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  if (!apiKey) {
    throw new Error(
      "PIPEDRIVE_API_KEY is missing from .env"
    );
  }

  if (!companyDomain) {
    throw new Error(
      "PIPEDRIVE_COMPANY_DOMAIN is missing from .env"
    );
  }

  /*
   * Expected .env:
   *
   * PIPEDRIVE_COMPANY_DOMAIN=mycompany
   *
   * NOT:
   *
   * https://mycompany.pipedrive.com
   */

  const separator = endpoint.includes("?")
    ? "&"
    : "?";

  const url =
    `https://${companyDomain}.pipedrive.com` +
    `${endpoint}${separator}` +
    `api_token=${encodeURIComponent(apiKey)}`;

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(
        `Unable to connect to Pipedrive: ${error.message}`
      );
    }

    throw new Error(
      "Unable to connect to Pipedrive."
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();

    throw new Error(
      `Pipedrive API request failed ` +
        `(${response.status} ${response.statusText}): ` +
        errorBody
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(
      "Pipedrive returned an invalid JSON response."
    );
  }
};

// --------------------------------------------------
// Build Pipedrive payload
// --------------------------------------------------

const buildPersonPayload = (
  typedMappings: Mapping[],
  typedInputData: InputData
): PipedrivePersonPayload => {
  const personPayload: PipedrivePersonPayload = {};

  for (const mapping of typedMappings) {
    // Validate mapping
    if (
      !mapping.pipedriveKey ||
      !mapping.inputKey
    ) {
      console.warn(
        "Skipping invalid mapping:",
        mapping
      );

      continue;
    }

    const value = getValueByPath(
      typedInputData,
      mapping.inputKey
    );

    // ------------------------------------------------
    // Edge case 1:
    // Missing mapped value
    // ------------------------------------------------

    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      console.warn(
        `Skipping "${mapping.pipedriveKey}" because ` +
          `"${mapping.inputKey}" has no value.`
      );

      continue;
    }

    // ------------------------------------------------
    // Email
    // ------------------------------------------------

    if (mapping.pipedriveKey === "email") {
      personPayload.emails = [
        {
          value: String(value),
          primary: true,
          label: "work",
        },
      ];

      continue;
    }

    // ------------------------------------------------
    // Phone
    // ------------------------------------------------

    if (mapping.pipedriveKey === "phone") {
      personPayload.phones = [
        {
          value: String(value),
          primary: true,
          label: "home",
        },
      ];

      continue;
    }

    // ------------------------------------------------
    // Other fields
    // ------------------------------------------------

    personPayload[mapping.pipedriveKey] =
      value;
  }

  return personPayload;
};

// --------------------------------------------------
// Main synchronization function
// --------------------------------------------------

const syncPdPerson =
  async (): Promise<PipedrivePerson> => {
    // ------------------------------------------------
    // 1. Validate environment
    // ------------------------------------------------

    if (!apiKey) {
      throw new Error(
        "PIPEDRIVE_API_KEY is missing. " +
          "Please add it to .env."
      );
    }

    if (!companyDomain) {
      throw new Error(
        "PIPEDRIVE_COMPANY_DOMAIN is missing. " +
          "Please add it to .env."
      );
    }

    // ------------------------------------------------
    // 2. Prepare data
    // ------------------------------------------------

    const typedMappings =
      mappings as Mapping[];

    const typedInputData =
      inputData as InputData;

    if (
      !Array.isArray(typedMappings) ||
      typedMappings.length === 0
    ) {
      throw new Error(
        "mappings.json is empty or invalid."
      );
    }

    // ------------------------------------------------
    // 3. Find name mapping
    // ------------------------------------------------

    const nameMapping =
      typedMappings.find(
        (mapping) =>
          mapping.pipedriveKey === "name"
      );

    if (!nameMapping) {
      throw new Error(
        'No mapping found for "name". ' +
          "A name mapping is required."
      );
    }

    // ------------------------------------------------
    // 4. Get person's name
    // ------------------------------------------------

    const personNameValue =
      getValueByPath(
        typedInputData,
        nameMapping.inputKey
      );

    if (
      typeof personNameValue !== "string" ||
      personNameValue.trim().length === 0
    ) {
      throw new Error(
        `The mapped name value ` +
          `"${nameMapping.inputKey}" ` +
          "is missing or empty."
      );
    }

    const personName =
      personNameValue.trim();

    // ------------------------------------------------
    // 5. Build payload
    // ------------------------------------------------

    const personPayload =
      buildPersonPayload(
        typedMappings,
        typedInputData
      );

    if (
      typeof personPayload.name !==
        "string" ||
      personPayload.name.trim().length === 0
    ) {
      throw new Error(
        "Generated Pipedrive payload does not " +
          "contain a valid name."
      );
    }

    console.log(
      "\nPayload to synchronize:"
    );

    console.log(
      JSON.stringify(
        personPayload,
        null,
        2
      )
    );

    // ------------------------------------------------
    // 6. Search for existing person
    // ------------------------------------------------

    const searchParams =
      new URLSearchParams({
        term: personName,
        fields: "name",
        exact_match: "true",
      });

    const searchResponse =
      await pipedriveRequest<
        PipedriveApiResponse<PipedriveSearchResponse>
      >(
        `/api/v2/persons/search?` +
          searchParams.toString()
      );

    if (!searchResponse.success) {
      throw new Error(
        "Pipedrive person search was unsuccessful."
      );
    }

    /*
     * IMPORTANT:
     *
     * Search response:
     *
     * data.items[0].item
     *
     * The actual Pipedrive person is inside
     * the "item" property.
     */

    const searchItems =
      searchResponse.data?.items ?? [];

    const existingPeople =
      searchItems
        .map(
          (searchItem) =>
            searchItem.item
        )
        .filter(
          (
            person
          ): person is PipedrivePerson =>
            person !== undefined &&
            typeof person.id === "number"
        );

    console.log(
      `Found ${existingPeople.length} ` +
        `matching person(s).`
    );

    // ------------------------------------------------
    // 7. Duplicate-name edge case
    // ------------------------------------------------

    if (existingPeople.length > 1) {
      throw new Error(
        `Multiple Pipedrive persons were found ` +
          `with the name "${personName}". ` +
          "Synchronization stopped to avoid " +
          "updating the wrong person."
      );
    }

    // ------------------------------------------------
    // 8. Existing person -> UPDATE
    // ------------------------------------------------

    if (existingPeople.length === 1) {
      const existingPerson =
        existingPeople[0];

      if (!existingPerson) {
        throw new Error(
          "Pipedrive returned an invalid person."
        );
      }

      /*
       * Edge case 2:
       *
       * Verify the search result has a valid ID
       * before constructing the update URL.
       */

      if (
        typeof existingPerson.id !==
          "number"
      ) {
        throw new Error(
          "Existing Pipedrive person does not " +
            "have a valid ID."
        );
      }

      console.log(
        `Existing person found: ` +
          `${existingPerson.name} ` +
          `(ID: ${existingPerson.id})`
      );

      const updateResponse =
        await pipedriveRequest<
          PipedriveApiResponse<PipedrivePerson>
        >(
          `/api/v2/persons/${existingPerson.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(
              personPayload
            ),
          }
        );

      if (
        !updateResponse.success ||
        !updateResponse.data
      ) {
        throw new Error(
          `Failed to update Pipedrive person ` +
            `with ID ${existingPerson.id}.`
        );
      }

      console.log(
        `Updated Pipedrive person: ` +
          `${updateResponse.data.name} ` +
          `(ID: ${updateResponse.data.id})`
      );

      return updateResponse.data;
    }

    // ------------------------------------------------
    // 9. No person -> CREATE
    // ------------------------------------------------

    console.log(
      `No person found with name "${personName}".`
    );

    const createResponse =
      await pipedriveRequest<
        PipedriveApiResponse<PipedrivePerson>
      >(
        "/api/v2/persons",
        {
          method: "POST",
          body: JSON.stringify(
            personPayload
          ),
        }
      );

    if (
      !createResponse.success ||
      !createResponse.data
    ) {
      throw new Error(
        "Failed to create Pipedrive person."
      );
    }

    console.log(
      `Created Pipedrive person: ` +
        `${createResponse.data.name} ` +
        `(ID: ${createResponse.data.id})`
    );

    return createResponse.data;
  };

// --------------------------------------------------
// Run synchronization
// --------------------------------------------------

syncPdPerson()
  .then((pipedrivePerson) => {
    console.log(
      "\nSynchronization completed successfully."
    );

    console.log(
      JSON.stringify(
        pipedrivePerson,
        null,
        2
      )
    );
  })
  .catch((error: unknown) => {
    console.error(
      "\nSynchronization failed:"
    );

    if (error instanceof Error) {
      console.error(
        "Message:",
        error.message
      );

      console.error(
        "Stack:",
        error.stack
      );
    } else {
      console.error(
        "Unknown error:",
        error
      );
    }

    process.exitCode = 1;
  });

import type { Region } from "./types";

// Conventional Indian geographic/administrative zone grouping, used for the
// region filter. UTs are grouped by their geographic zone where clearly
// applicable; small/remote UTs get their own bucket.
export const STATE_REGION: Record<string, Region> = {
  "Jammu & Kashmir": "North",
  "Ladakh": "North",
  "Himachal Pradesh": "North",
  "Punjab": "North",
  "Haryana": "North",
  "Uttarakhand": "North",
  "Uttar Pradesh": "North",
  "Rajasthan": "North",
  "Chandigarh": "Union Territory",
  "Delhi": "North",

  "Andhra Pradesh": "South",
  "Telangana": "South",
  "Karnataka": "South",
  "Kerala": "South",
  "Tamil Nadu": "South",
  "Puducherry": "Union Territory",
  "Lakshadweep": "Union Territory",
  "Andaman & Nicobar": "Union Territory",

  "West Bengal": "East",
  "Odisha": "East",
  "Jharkhand": "East",
  "Bihar": "East",

  "Gujarat": "West",
  "Maharashtra": "West",
  "Goa": "West",
  "Dadra & Nagar Haveli": "Union Territory",
  "Daman & Diu": "Union Territory",

  "Madhya Pradesh": "Central",
  "Chhattisgarh": "Central",

  "Assam": "Northeast",
  "Arunachal Pradesh": "Northeast",
  "Manipur": "Northeast",
  "Meghalaya": "Northeast",
  "Mizoram": "Northeast",
  "Nagaland": "Northeast",
  "Sikkim": "Northeast",
  "Tripura": "Northeast",
};

export const ALL_REGIONS: Region[] = [
  "North",
  "South",
  "East",
  "West",
  "Central",
  "Northeast",
  "Union Territory",
];

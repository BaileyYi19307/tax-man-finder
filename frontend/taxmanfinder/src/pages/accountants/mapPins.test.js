import { pinEligibleAccountants } from "./mapPins";

test("pinEligibleAccountants keeps only rows with numeric coordinates", () => {
  const rows = [
    {
      user_id: 1,
      email: "a@test.com",
      first_name: "A",
      last_name: "One",
      bio: "x",
      credentials: "CPA",
      years_experience: 1,
      firm_name: "",
      location: "Philadelphia, PA",
      latitude: 39.95,
      longitude: -75.16,
      services: [],
      profile_complete: true,
    },
    {
      user_id: 2,
      email: "b@test.com",
      first_name: "B",
      last_name: "Two",
      bio: "x",
      credentials: "CPA",
      years_experience: 1,
      firm_name: "",
      location: "Remote",
      latitude: null,
      longitude: null,
      services: [],
      profile_complete: true,
    },
  ];

  const pins = pinEligibleAccountants(rows);
  expect(pins).toHaveLength(1);
  expect(pins[0].user_id).toBe(1);
});

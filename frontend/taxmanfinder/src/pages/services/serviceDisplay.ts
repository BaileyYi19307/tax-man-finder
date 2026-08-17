import type { CatalogService } from "../../api/client";

export type { CatalogService };

export function formatServicePrice(
  service: Pick<CatalogService, "pricing_type" | "indicative_price">
) {
  if (service.pricing_type === "consultation_required") {
    return "Consultation required";
  }
  if (service.indicative_price == null || service.indicative_price === "") {
    return "Price on request";
  }
  if (service.pricing_type === "hourly") {
    return `$${service.indicative_price}/hr`;
  }
  return `$${service.indicative_price}`;
}

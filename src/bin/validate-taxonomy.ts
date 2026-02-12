import { defaultTaxonomyPath, loadTaxonomy, TaxonomyValidationError } from "../taxonomy/loader.js";

const taxonomyPath = process.argv[2] ?? defaultTaxonomyPath();

try {
  const taxonomy = loadTaxonomy(taxonomyPath);

  const categories = Array.isArray(taxonomy.categories) ? taxonomy.categories : [];
  const categoryCount = categories.length;
  const ruleCount = categories.reduce((total, category) => {
    if (category && typeof category === "object" && Array.isArray((category as { rules?: unknown[] }).rules)) {
      return total + ((category as { rules: unknown[] }).rules.length);
    }
    return total;
  }, 0);

  console.log("taxonomy valid");
  console.log(`path: ${taxonomyPath}`);
  console.log(`version: ${String(taxonomy.version)}`);
  console.log(`categories: ${categoryCount}`);
  console.log(`rules: ${ruleCount}`);
} catch (error) {
  console.error("taxonomy invalid");

  if (error instanceof TaxonomyValidationError) {
    for (const validationError of error.errors) {
      console.error(`- ${validationError}`);
    }
    process.exit(1);
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`- unexpected error: ${message}`);
  process.exit(1);
}

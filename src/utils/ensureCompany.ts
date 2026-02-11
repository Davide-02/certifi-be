import { Company, ICompany } from "../models/Company";

/**
 * Ensure a company exists, create default if it doesn't
 */
export async function ensureCompany(companyId: number): Promise<ICompany> {
  let company = await Company.findOne({ id: companyId }).exec();

  if (!company) {
    // Create default company if it doesn't exist
    company = new Company({
      id: companyId,
      name: `Company ${companyId}`,
      slug: `company-${companyId}`,
      settings: {
        certificationPolicy: {
          minConfidence: 0.8,
          allowedDocumentFamilies: [],
          requireManualReview: false,
        },
      },
    });

    await company.save();
    console.log(`[ensureCompany] Created default company with id=${companyId}`);
  }

  return company;
}

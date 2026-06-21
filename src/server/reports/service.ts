// The reporting service: the single server entry point for every report. Accepts
// a typed request { reportType, dateRange, portfolioId?, propertyId?, ownerId? }
// and returns the typed report model (rows + totals), with optional pagination
// for large ledgers. Assembles the dataset (with the account's time zone) once
// and delegates to the pure builders.

import "server-only";
import {
  getTransactions,
  getAllProperties,
  getPortfolios,
  getCompanies,
  getTenancies,
  getUsers,
  getDirectorLoanMovements,
  getAccount,
} from "@/services/repository";
import { buildReport, type ReportDataset, type ReportFilters } from "@/lib/reports/build";
import type { ReportModel } from "@/lib/reports/model";
import { taxYearFor } from "@/lib/dates";
import { now } from "@/lib/clock";

export interface ReportRequest {
  reportType: string;
  dateRange: { from: string; to: string };
  portfolioId?: string;
  propertyId?: string;
  ownerId?: string;
  /** 1-based page; with pageSize, paginates the primary (first) section. */
  page?: number;
  pageSize?: number;
}

export interface ReportPagination {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export interface ReportResult {
  model: ReportModel;
  pagination?: ReportPagination;
}

/** Assemble the serialisable dataset every builder runs against. */
export function buildDataset(): ReportDataset {
  const account = getAccount();
  return {
    transactions: getTransactions(),
    properties: getAllProperties(),
    portfolios: getPortfolios(),
    companies: getCompanies(),
    tenancies: getTenancies(),
    users: getUsers(),
    directorLoans: getDirectorLoanMovements(),
    taxYear: taxYearFor(now()),
    today: now().toISOString().slice(0, 10),
    timeZone: account.timeZone,
    generatedAt: now().toISOString(),
  };
}

export function runReport(req: ReportRequest, dataset: ReportDataset = buildDataset()): ReportResult {
  const filters: ReportFilters = {
    from: req.dateRange.from,
    to: req.dateRange.to,
    portfolioId: req.portfolioId ?? "",
    propertyId: req.propertyId || undefined,
    ownerId: req.ownerId || undefined,
  };
  const model = buildReport(dataset, req.reportType, filters);

  if (req.page && req.pageSize) {
    const primary = model.sections[0];
    const totalRows = primary.rows.length;
    const start = (req.page - 1) * req.pageSize;
    primary.rows = primary.rows.slice(start, start + req.pageSize);
    return {
      model,
      pagination: { page: req.page, pageSize: req.pageSize, totalRows, totalPages: Math.max(1, Math.ceil(totalRows / req.pageSize)) },
    };
  }
  return { model };
}

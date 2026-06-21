-- AlterEnum: add the smoke/CO alarm evidence kind.
ALTER TYPE "EvidenceKind" ADD VALUE IF NOT EXISTS 'SMOKE_CO_ALARM';

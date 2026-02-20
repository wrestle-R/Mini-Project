"use client";

import { use } from "react";
import { ContractorProjectDetail } from "@/components/contractor/contractor-project-detail";

export default function ContractorProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ContractorProjectDetail assignmentId={id} />;
}

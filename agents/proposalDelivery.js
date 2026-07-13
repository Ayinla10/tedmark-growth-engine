import { writeFile } from 'fs/promises';
import { getProposalById } from '../tools/db.js';
import { renderProposalPdf } from '../tools/proposalPdf.js';
import { sendEmail } from '../tools/emailSender.js';

function filenameFor(proposal) {
  const safeName = proposal.business_name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${safeName || 'proposal'}.pdf`;
}

export async function runExportProposal({ proposalId, outPath }) {
  console.log(`[proposal-delivery] Fetching proposal ${proposalId}...`);
  const proposal = await getProposalById(proposalId);

  if (!proposal) {
    console.error(`[proposal-delivery] No proposal found with id ${proposalId}.`);
    process.exitCode = 1;
    return;
  }

  console.log(`[proposal-delivery] Rendering PDF for "${proposal.business_name}"...`);
  const pdfBuffer = await renderProposalPdf(proposal);
  await writeFile(outPath, pdfBuffer);

  console.log(`[proposal-delivery] Wrote PDF to ${outPath}`);
}

export async function runSendProposal({ proposalId }) {
  console.log(`[proposal-delivery] Fetching proposal ${proposalId}...`);
  const proposal = await getProposalById(proposalId);

  if (!proposal) {
    console.error(`[proposal-delivery] No proposal found with id ${proposalId}.`);
    process.exitCode = 1;
    return;
  }

  if (!proposal.lead_email) {
    console.error(`[proposal-delivery] Lead "${proposal.business_name}" has no email on file — cannot send.`);
    process.exitCode = 1;
    return;
  }

  console.log(`[proposal-delivery] Rendering PDF for "${proposal.business_name}"...`);
  const pdfBuffer = await renderProposalPdf(proposal);

  console.log(`[proposal-delivery] Sending to ${proposal.lead_email}...`);
  await sendEmail({
    to: proposal.lead_email,
    subject: `Proposal for ${proposal.business_name} — Tedmark Digital Agency`,
    text: `Hi,\n\nPlease find attached our proposal for ${proposal.business_name}.\n\nLooking forward to hearing your thoughts.\n\nBest,\nTedmark Digital Agency`,
    attachments: [{ filename: filenameFor(proposal), content: pdfBuffer }],
  });

  console.log(`[proposal-delivery] Sent proposal to ${proposal.lead_email}.`);
}

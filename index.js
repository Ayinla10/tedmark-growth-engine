import { runScout } from './agents/scout.js';
import { runWebScout } from './agents/webScout.js';
import { runDirectoryScout } from './agents/directoryScout.js';
import { runQualifier } from './agents/qualifier.js';
import { runOutreach, runApprove, runSend } from './agents/outreach.js';
import { runEnricher } from './agents/enricher.js';
import { insertEnrichEvent, ensureEnrichEventsTable } from './tools/db.js';
import { runDmEnrich } from './agents/dmEnrich.js';
import { runIcpScorer } from './agents/icpScorer.js';
import { runSequencer, startSequencerCron } from './agents/sequencer.js';
import { runProposal } from './agents/proposal.js';
import { runAnalytics } from './agents/analytics.js';
import { runCleanKnowledge } from './agents/knowledgeCleaner.js';
import { runReplyWatcher } from './agents/replyWatcher.js';
import { runExportProposal, runSendProposal } from './agents/proposalDelivery.js';
import { runDailyPipeline } from './scripts/dailyPipeline.js';
import { runTelegramBot } from './agents/telegramBot.js';
import { createTelegramLinkCode, findUserForTelegramLink } from './tools/db.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
      args[key] = value;
      if (value !== true) i += 1;
    }
  }
  return args;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  switch (command) {
    case 'scout': {
      const sector = args.sector;
      const city = args.city;
      const limit = parseInt(args.limit, 10) || 20;
      const country = (args.country || 'GH').toUpperCase();

      if (!sector || !city) {
        console.error('Usage: node index.js scout --sector "restaurant" --city "Accra" --limit 20 --country GH');
        process.exit(1);
      }

      await runScout({ sector, city, limit, country });
      break;
    }

    case 'web-scout': {
      const sector = args.sector;
      const city = args.city;
      const query = args.query;
      const queryType = args['query-type'] || 'web';
      const offset = parseInt(args.offset, 10) || 0;
      const country = (args.country || 'GH').toUpperCase();

      if (!sector || !city || !query) {
        console.error('Usage: node index.js web-scout --sector "restaurant" --city "Accra" --query "..." --query-type web --offset 0 --country GH');
        process.exit(1);
      }

      await runWebScout({ sector, city, query, queryType, offset, country });
      break;
    }

    case 'directory-scout': {
      const sector = args.sector;
      const categorySlug = args.category;
      const page = parseInt(args.page, 10) || 1;

      if (!sector || !categorySlug) {
        console.error('Usage: node index.js directory-scout --sector "restaurant" --category "caterers" --page 1');
        process.exit(1);
      }

      await runDirectoryScout({ sector, categorySlug, page });
      break;
    }

    case 'qualify': {
      const limit = parseInt(args.limit, 10) || 10;
      const leadId = args['lead-id'];
      await runQualifier({ limit, leadId });
      break;
    }

    case 'enrich': {
      const limit = parseInt(args.limit, 10) || 20;
      const leadId = args['lead-id'];
      await ensureEnrichEventsTable();
      const emit = leadId
        ? async (type, message) => {
            await insertEnrichEvent(leadId, type, message);
            console.log(`[${type}] ${message}`);
          }
        : (type, message) => { console.log(`[${type}] ${message}`); };
      await runEnricher({ limit, leadId, emit });
      break;
    }

    case 'enrich-dm': {
      const limit = parseInt(args.limit, 10) || 20;
      const leadId = args['lead-id'];
      await runDmEnrich({ limit, leadId });
      break;
    }

    case 'icp-score': {
      const limit = parseInt(args.limit, 10) || 20;
      const leadId = args['lead-id'];
      await runIcpScorer({ limit, leadId });
      break;
    }

    case 'outreach': {
      const limit = parseInt(args.limit, 10) || 10;
      const leadId = args['lead-id'];
      const signatureId = args['signature-id'];
      await runOutreach({ limit, leadId, signatureId });
      break;
    }

    case 'approve': {
      const outreachId = args['outreach-id'];

      if (!outreachId) {
        console.error('Usage: node index.js approve --outreach-id <uuid>');
        process.exit(1);
      }

      await runApprove({ outreachId });
      break;
    }

    case 'send': {
      const outreachId = args['outreach-id'];
      const to = typeof args.to === 'string' ? args.to : undefined;

      if (!outreachId) {
        console.error('Usage: node index.js send --outreach-id <uuid> [--to email@example.com]');
        process.exit(1);
      }

      await runSend({ outreachId, to });
      break;
    }

    case 'sequence': {
      if (args['run-now']) {
        await runSequencer();
      } else {
        startSequencerCron();
        console.log('[index] Sequencer cron scheduled. Press Ctrl+C to exit.');
        return; // keep process alive for cron
      }
      break;
    }

    case 'proposal': {
      const leadId = args['lead-id'];
      const services = typeof args.services === 'string' ? args.services.split(',').map((s) => s.trim()) : [];
      const budgetRange = args.budget;

      if (!leadId || services.length === 0 || !budgetRange) {
        console.error('Usage: node index.js proposal --lead-id <uuid> --services "website,seo" --budget "mid"');
        process.exit(1);
      }

      await runProposal({ leadId, services, budgetRange });
      break;
    }

    case 'analytics': {
      await runAnalytics();
      break;
    }

    case 'clean-knowledge': {
      const category = args.category;
      const text = args.text;

      if (!category || !text) {
        console.error('Usage: node index.js clean-knowledge --category "Services & Pricing" --text "<raw text>"');
        process.exit(1);
      }

      await runCleanKnowledge({ category, text });
      break;
    }

    case 'daily': {
      await runDailyPipeline();
      break;
    }

    case 'check-replies': {
      await runReplyWatcher();
      break;
    }

    case 'export-proposal': {
      const proposalId = args['proposal-id'];
      const outPath = args.out;

      if (!proposalId || !outPath) {
        console.error('Usage: node index.js export-proposal --proposal-id <uuid> --out <filepath>');
        process.exit(1);
      }

      await runExportProposal({ proposalId, outPath });
      break;
    }

    case 'send-proposal': {
      const proposalId = args['proposal-id'];

      if (!proposalId) {
        console.error('Usage: node index.js send-proposal --proposal-id <uuid>');
        process.exit(1);
      }

      await runSendProposal({ proposalId });
      break;
    }

    case 'telegram-bot': {
      await runTelegramBot();
      break;
    }

    case 'telegram-link': {
      const email = args.email;
      const user = await findUserForTelegramLink(email);

      if (!user) {
        console.error(
          email
            ? `No user found with email ${email}.`
            : 'Multiple users exist — specify one with --email you@example.com'
        );
        process.exit(1);
      }

      const code = await createTelegramLinkCode(user.id, user.agency_id);
      console.log(`Link code: ${code}`);
      console.log('Expires in 10 minutes.');
      console.log('');
      console.log('Send this to the bot in Telegram:');
      console.log(`  /link ${code}`);
      break;
    }

    default: {
      console.log('Tedmark AI Growth Engine — CLI');
      console.log('');
      console.log('Available commands:');
      console.log('  node index.js scout --sector "restaurant" --city "Accra" --limit 20');
      console.log('  node index.js web-scout --sector "restaurant" --city "Accra" --query "..." --query-type web --offset 0');
      console.log('  node index.js directory-scout --sector "restaurant" --category "caterers" --page 1');
      console.log('  node index.js qualify --limit 10');
      console.log('  node index.js enrich --limit 20');
      console.log('  node index.js enrich-dm --limit 20');
      console.log('  node index.js icp-score --limit 20');
      console.log('  node index.js outreach --limit 10');
      console.log('  node index.js approve --outreach-id <uuid>');
      console.log('  node index.js send --outreach-id <uuid> [--to email@example.com]');
      console.log('  node index.js sequence --run-now');
      console.log('  node index.js sequence');
      console.log('  node index.js proposal --lead-id <uuid> --services "website,seo" --budget "mid"');
      console.log('  node index.js analytics');
      console.log('  node index.js clean-knowledge --category "Services & Pricing" --text "<raw text>"');
      console.log('  node index.js daily');
      console.log('  node index.js check-replies');
      console.log('  node index.js export-proposal --proposal-id <uuid> --out <filepath>');
      console.log('  node index.js telegram-link [--email you@example.com]');
      console.log('  node index.js telegram-bot');
      console.log('  node index.js send-proposal --proposal-id <uuid>');
      process.exit(command ? 1 : 0);
    }
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err);
  process.exit(1);
});

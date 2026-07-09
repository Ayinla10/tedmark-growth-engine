import { runScout } from './agents/scout.js';
import { runQualifier } from './agents/qualifier.js';
import { runOutreach, runApprove, runSend } from './agents/outreach.js';
import { runEnricher } from './agents/enricher.js';
import { runSequencer, startSequencerCron } from './agents/sequencer.js';
import { runProposal } from './agents/proposal.js';
import { runAnalytics } from './agents/analytics.js';
import { runDailyPipeline } from './scripts/dailyPipeline.js';

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

      if (!sector || !city) {
        console.error('Usage: node index.js scout --sector "restaurant" --city "Accra" --limit 20');
        process.exit(1);
      }

      await runScout({ sector, city, limit });
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
      await runEnricher({ limit, leadId });
      break;
    }

    case 'outreach': {
      const limit = parseInt(args.limit, 10) || 10;
      const leadId = args['lead-id'];
      await runOutreach({ limit, leadId });
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

    case 'daily': {
      await runDailyPipeline();
      break;
    }

    default: {
      console.log('Tedmark AI Growth Engine — CLI');
      console.log('');
      console.log('Available commands:');
      console.log('  node index.js scout --sector "restaurant" --city "Accra" --limit 20');
      console.log('  node index.js qualify --limit 10');
      console.log('  node index.js enrich --limit 20');
      console.log('  node index.js outreach --limit 10');
      console.log('  node index.js approve --outreach-id <uuid>');
      console.log('  node index.js send --outreach-id <uuid> [--to email@example.com]');
      console.log('  node index.js sequence --run-now');
      console.log('  node index.js sequence');
      console.log('  node index.js proposal --lead-id <uuid> --services "website,seo" --budget "mid"');
      console.log('  node index.js analytics');
      console.log('  node index.js daily');
      process.exit(command ? 1 : 0);
    }
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err);
  process.exit(1);
});

// Stage 1 placeholder — engine debug simulation. Replaced by real UI in Stage 2.
import { runDebugSimulation } from './engine/simulate';

const app = document.getElementById('app');
if (app) {
  app.innerHTML = '<h1>Case Runner</h1><p>Stage 1: engine scaffold. See console for a simulated game.</p>';
}
runDebugSimulation();

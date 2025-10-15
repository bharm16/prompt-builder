import ErrorBoundary from './components/ErrorBoundary';
import PromptOptimizerContainer from './features/prompt-optimizer/PromptOptimizerContainer';

function App() {
  return (
    <ErrorBoundary>
      <PromptOptimizerContainer />
    </ErrorBoundary>
  );
}

export default App;

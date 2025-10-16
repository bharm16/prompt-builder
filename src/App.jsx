import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import PromptOptimizerContainer from './features/prompt-optimizer/PromptOptimizerContainer';
import SharedPrompt from './components/SharedPrompt';
import { ToastProvider } from './components/Toast';

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/" element={<PromptOptimizerContainer />} />
            <Route path="/prompt/:uuid" element={<PromptOptimizerContainer />} />
            <Route path="/share/:uuid" element={<SharedPrompt />} />
          </Routes>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;

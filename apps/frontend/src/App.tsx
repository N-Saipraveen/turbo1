import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Database } from 'lucide-react';
import Home from './routes/Home';
import Convert from './routes/Convert';
import Visualize from './routes/Visualize';
import Migrate from './routes/Migrate';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl">
              <Database className="h-6 w-6 text-primary" />
              TurboDbx
            </Link>
            <div className="flex items-center gap-6">
              <Link
                to="/convert"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Convert
              </Link>
              <Link
                to="/visualize"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Visualize
              </Link>
              <Link
                to="/migrate"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Migrate
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/convert" element={<Convert />} />
          <Route path="/visualize" element={<Visualize />} />
          <Route path="/migrate" element={<Migrate />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

export default App;

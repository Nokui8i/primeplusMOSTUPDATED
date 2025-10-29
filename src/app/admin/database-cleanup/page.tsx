'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Trash2, Search, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface AnalysisResult {
  orphanedComments: Array<{ postId: string; commentCount: number }>;
  orphanedMessages: Array<{ userId: string; sharedChatId: string }>;
  oldChatStructure: Array<any>;
  stats: {
    totalComments: number;
    totalOldChats: number;
    totalPersonalChats: number;
    orphanedCommentsCount: number;
    orphanedPersonalChatsCount: number;
  };
}

export default function DatabaseCleanupPage() {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch('/api/admin/cleanup-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze' })
      });

      const data = await response.json();

      if (data.success) {
        setAnalysisResult(data.issues);
        toast.success('Analysis completed!');
      } else {
        const errorMessage = data.error || 'Analysis failed';
        let description = '';
        
        if (data.details) {
          if (data.details.missing) {
            const missing = Object.entries(data.details.missing)
              .filter(([_, value]) => value)
              .map(([key]) => key)
              .join(', ');
            
            if (missing) {
              description = `Missing: ${missing}. `;
            }
          }
          if (data.details.hint) {
            description += data.details.hint;
          } else if (data.details.privateKeyLength) {
            description += `Private key length: ${data.details.privateKeyLength} characters. Make sure it includes BEGIN and END lines with \\n for line breaks.`;
          }
        }
        
        toast.error(errorMessage, {
          description: description || data.details || 'Please check the console for more details',
          duration: 10000
        });
        console.error('Analysis error:', data);
      }
    } catch (error: any) {
      toast.error('Failed to analyze: ' + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCleanup = async (type: 'comments' | 'chats' | 'all') => {
    if (!confirm(`Are you sure you want to delete ${type === 'all' ? 'all orphaned data' : `orphaned ${type}`}? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/cleanup-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: `cleanup-${type === 'chats' ? 'personal-chats' : type}` })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || 'Cleanup completed!');
        // Re-analyze after cleanup
        setTimeout(() => handleAnalyze(), 1000);
      } else {
        const errorMessage = data.error || 'Cleanup failed';
        toast.error(errorMessage, {
          description: data.details || 'Please check the console for more details'
        });
        console.error('Cleanup error:', data);
      }
    } catch (error: any) {
      toast.error('Failed to cleanup: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Database Cleanup</h1>
          <p className="text-gray-600 mt-2">Analyze and clean up orphaned data</p>
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="flex items-center gap-2"
        >
          {analyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Analyze Database
            </>
          )}
        </Button>
      </div>

      {analysisResult && (
        <div className="grid gap-6">
          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Overview of database issues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {analysisResult.stats.totalComments}
                  </div>
                  <div className="text-sm text-gray-600">Total Comments</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {analysisResult.stats.orphanedCommentsCount}
                  </div>
                  <div className="text-sm text-gray-600">Orphaned Comments</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {analysisResult.stats.totalPersonalChats}
                  </div>
                  <div className="text-sm text-gray-600">Personal Chats</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {analysisResult.stats.orphanedPersonalChatsCount}
                  </div>
                  <div className="text-sm text-gray-600">Orphaned Chats</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Orphaned Comments */}
          {analysisResult.stats.orphanedCommentsCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Orphaned Comments
                </CardTitle>
                <CardDescription>
                  {analysisResult.stats.orphanedCommentsCount} comments referencing non-existent posts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    These comments are referencing posts that no longer exist. They can be safely deleted.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                  {analysisResult.orphanedComments.slice(0, 10).map((item, idx) => (
                    <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
                      Post ID: {item.postId} - {item.commentCount} comments
                    </div>
                  ))}
                  {analysisResult.orphanedComments.length > 10 && (
                    <div className="text-sm text-gray-500">
                      ...and {analysisResult.orphanedComments.length - 10} more
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => handleCleanup('comments')}
                  disabled={loading}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cleaning...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Orphaned Comments
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Orphaned Personal Chats */}
          {analysisResult.stats.orphanedPersonalChatsCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Orphaned Personal Chats
                </CardTitle>
                <CardDescription>
                  {analysisResult.stats.orphanedPersonalChatsCount} personal chats referencing non-existent shared chats
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    These personal chat entries reference shared chats that no longer exist. They can be safely deleted.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                  {analysisResult.orphanedMessages.slice(0, 10).map((item, idx) => (
                    <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
                      User: {item.userId.substring(0, 20)}... - Shared Chat: {item.sharedChatId}
                    </div>
                  ))}
                  {analysisResult.orphanedMessages.length > 10 && (
                    <div className="text-sm text-gray-500">
                      ...and {analysisResult.orphanedMessages.length - 10} more
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => handleCleanup('chats')}
                  disabled={loading}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cleaning...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Orphaned Chats
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* All Clean */}
          {analysisResult.stats.orphanedCommentsCount === 0 && 
           analysisResult.stats.orphanedPersonalChatsCount === 0 && (
            <Alert>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <AlertTitle>Database is Clean!</AlertTitle>
              <AlertDescription>
                No orphaned data found. Your database is in good shape.
              </AlertDescription>
            </Alert>
          )}

          {/* Clean All Button */}
          {(analysisResult.stats.orphanedCommentsCount > 0 || 
            analysisResult.stats.orphanedPersonalChatsCount > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Clean All</CardTitle>
                <CardDescription>Remove all orphaned data at once</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => handleCleanup('all')}
                  disabled={loading}
                  variant="destructive"
                  size="lg"
                  className="w-full flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cleaning All...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Clean All Orphaned Data
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!analysisResult && !analyzing && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-600">Click "Analyze Database" to check for issues</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

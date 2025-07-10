'use client';
import { useState, useEffect } from 'react';

interface Post {
  id: string;
  message?: string;
  created_time?: string;
  likes?: {
    summary?: {
      total_count: number;
    };
  };
  comments?: {
    summary?: {
      total_count: number;
    };
  };
  shares?: {
    count: number;
  };
}

interface Comment {
  id: string;
  message: string;
  created_time?: string;
  from?: {
    name: string;
  };
  likes?: {
    summary?: {
      total_count: number;
    };
  };
}

interface Message {
  id: string;
  message: string;
  created_time?: string;
  from?: {
    name: string;
  };
}

interface Participant {
  name: string;
}

interface Conversation {
  id: string;
  participants?: {
    data?: Participant[];
  };
  messages?: {
    data?: Message[];
  };
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [messages, setMessages] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  const fetchData = async (type: string, postId = '') => {
    setLoading(true);
    setError(null);
    
    try {
      const url = `/api/facebook?type=${type}${postId ? `&postId=${postId}` : ''}`;
      // console.log('Fetching:', url);
      
      const res = await fetch(url);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      // console.log('Response data:', data);
      
      // Check if we're using mock data (mock data has predictable IDs)
      if (data.data && data.data.length > 0 && data.data[0].id === '1') {
        setIsUsingMockData(true);
      }
      
      if (type === 'posts') setPosts(data.data || []);
      if (type === 'comments') setComments(data.data || []);
      if (type === 'messages') setMessages(data.data || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData('posts');
  }, []);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Facebook Page Interactions</h1>

      {/* Mock Data Warning */}
      {isUsingMockData && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <strong>Development Mode:</strong> Using mock data. To use real Facebook data, configure FACEBOOK_PAGE_ID and FACEBOOK_ACCESS_TOKEN in your .env.local file.
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Posts Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Posts ({posts.length})</h2>
          <button 
            onClick={() => fetchData('posts')}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh Posts'}
          </button>
        </div>
        
        {loading && posts.length === 0 ? (
          <div className="text-center py-4">Loading posts...</div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow-md p-6 border">
                <p className="text-gray-800 mb-3">{post.message || 'No message'}</p>
                <div className="text-sm text-gray-600 mb-3">
                  {formatDate(post.created_time)}
                </div>
                <div className="flex gap-4 text-sm text-gray-600 mb-3">
                  <span>👍 {post.likes?.summary?.total_count || 0} likes</span>
                  <span>💬 {post.comments?.summary?.total_count || 0} comments</span>
                  <span>🔄 {post.shares?.count || 0} shares</span>
                </div>
                <button 
                  onClick={() => fetchData('comments', post.id)}
                  disabled={loading}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Load Comments
                </button>
              </div>
            ))}
            {posts.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">
                No posts found. {isUsingMockData ? 'Mock data is being used for development.' : 'Make sure your Facebook credentials are configured correctly.'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comments Section */}
      {comments.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Comments ({comments.length})</h2>
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-gray-50 rounded-lg p-4 border">
                <p className="text-gray-800 mb-2">{comment.message}</p>
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>👤 {comment.from?.name || 'Unknown user'}</span>
                  <div className="flex gap-2">
                    <span>👍 {comment.likes?.summary?.total_count || 0}</span>
                    <span>{formatDate(comment.created_time)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Messages ({messages.length})</h2>
          <button 
            onClick={() => fetchData('messages')}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load Messages'}
          </button>
        </div>
        
        <div className="space-y-4">
          {messages.map((conversation) => (
            <div key={conversation.id} className="bg-white rounded-lg shadow-md p-6 border">
              <div className="mb-3">
                <strong>Participants:</strong> {
                  conversation.participants?.data?.map(p => p.name).join(', ') || 'Unknown'
                }
              </div>
              {conversation.messages?.data && conversation.messages.data.length > 0 && (
                <div>
                  <strong>Messages:</strong>
                  <div className="mt-2 space-y-2">
                    {conversation.messages.data.map((msg) => (
                      <div key={msg.id} className="bg-gray-50 p-3 rounded">
                        <p className="text-gray-800">{msg.message}</p>
                        <div className="text-sm text-gray-600 mt-1">
                          👤 {msg.from?.name || 'Unknown'} • {formatDate(msg.created_time)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {messages.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              No messages found. Click "Load Messages" to fetch conversations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
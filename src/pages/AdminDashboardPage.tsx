import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/UI';
import { motion } from 'motion/react';
import { ArrowLeft, Users, FileText, BookOpen, BarChart, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [data, setData] = useState<any>({ users: [], posts: [], resources: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, postsRes, resourcesRes] = await Promise.all([
          supabase.from('profiles').select('*'),
          supabase.from('posts').select('*'),
          supabase.from('resources').select('*'),
        ]);

        setData({
          users: usersRes.data ?? [],
          posts: postsRes.data ?? [],
          resources: resourcesRes.data ?? [],
        });
      } catch (err) {
        setError('Failed to load dashboard data.');
        console.error('Admin fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDelete = async (collectionName: string, id: string) => {
    if (!confirm('Are you sure?')) return;
    const table = collectionName === 'users' ? 'profiles' as const : collectionName as 'posts' | 'resources';
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      setData((prev: any) => ({
        ...prev,
        [collectionName]: prev[collectionName].filter((item: any) => item.id !== id)
      }));
    } catch (err) {
      setActionError('Failed to delete item. Please try again.');
      console.error('Admin delete error:', err);
    }
  };

  const [editingUser, setEditingUser] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: '' });

  const handleSave = async () => {
    try {
      if (editingUser) {
        const { error } = await supabase.from('profiles').update(formData).eq('id', editingUser.id);
        if (error) throw error;
        setData((prev: any) => ({
          ...prev,
          users: prev.users.map((u: any) => u.id === editingUser.id ? { ...u, ...formData } : u)
        }));
      } else {
        // Admin create — inserts into profiles (no auth user created)
        const { data: newUser, error } = await supabase.from('profiles').insert({
          id: crypto.randomUUID(),
          handle: formData.email?.split('@')[0] || formData.name.toLowerCase().replace(/\s+/g, ''),
          ...formData,
        }).select().single();
        if (error) throw error;
        setData((prev: any) => ({
          ...prev,
          users: [...prev.users, newUser]
        }));
      }
      setEditingUser(null);
      setIsAdding(false);
      setFormData({ name: '', email: '', role: '' });
    } catch (err) {
      setActionError('Failed to save user. Please try again.');
      console.error('Admin save error:', err);
    }
  };

  const startEdit = (user: any) => {
    setEditingUser(user);
    setFormData({ name: user.name, email: user.email, role: user.role });
  };

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'posts', label: 'Posts', icon: FileText },
    { id: 'resources', label: 'Resources', icon: BookOpen },
    { id: 'analytics', label: 'Analytics', icon: BarChart },
  ];

  return (
    <motion.main 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto px-6 pt-12 pb-32"
    >
      <header className="flex items-center justify-between mb-12">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-surface-container rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant/60">Admin Dashboard</h1>
        <div className="w-10" />
      </header>

      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'primary' : 'secondary'}
            onClick={() => setActiveTab(tab.id)}
            className="whitespace-nowrap"
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-primary-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center text-center py-20 space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-400/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-sm text-red-400 font-medium">{error}</p>
        </div>
      ) : (
        <Card className="min-h-[400px]">
          {actionError && (
            <div className="mb-4 p-3 bg-red-400/10 border border-red-400/20 rounded-lg flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-400 font-medium flex-1">{actionError}</p>
              <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-widest">Dismiss</button>
            </div>
          )}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">Users ({data.users.length})</h2>
                <Button size="sm" onClick={() => setIsAdding(true)}>Add User</Button>
              </div>
              
              {(isAdding || editingUser) && (
                <div className="p-4 bg-surface-container-highest rounded-lg space-y-3">
                  <input className="w-full p-2 rounded bg-background" placeholder="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  <input className="w-full p-2 rounded bg-background" placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  <input className="w-full p-2 rounded bg-background" placeholder="Role" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave}>Save</Button>
                    <Button variant="secondary" size="sm" onClick={() => {setEditingUser(null); setIsAdding(false);}}>Cancel</Button>
                  </div>
                </div>
              )}

              {data.users.length === 0 ? (
                <p className="text-center text-on-surface-variant text-sm py-8">No users found.</p>
              ) : data.users.map((user: any) => (
                <div key={user.id} className="flex justify-between items-center p-4 bg-surface-container-highest rounded-lg">
                  <div>
                    <p className="font-bold">{user.name}</p>
                    <p className="text-xs text-on-surface-variant">{user.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => startEdit(user)}>Edit</Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete('users', user.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'posts' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold mb-4">Posts ({data.posts.length})</h2>
              {data.posts.length === 0 ? (
                <p className="text-center text-on-surface-variant text-sm py-8">No posts found.</p>
              ) : data.posts.map((post: any) => (
                <div key={post.id} className="flex justify-between items-center p-4 bg-surface-container-highest rounded-lg">
                  <p className="text-sm truncate max-w-xs">{post.content}</p>
                  <Button variant="danger" size="sm" onClick={() => handleDelete('posts', post.id)}>Delete</Button>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'resources' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold mb-4">Resources ({data.resources.length})</h2>
              {data.resources.length === 0 ? (
                <p className="text-center text-on-surface-variant text-sm py-8">No resources found.</p>
              ) : data.resources.map((res: any) => (
                <div key={res.id} className="flex justify-between items-center p-4 bg-surface-container-highest rounded-lg">
                  <p className="font-bold">{res.title}</p>
                  <Button variant="danger" size="sm" onClick={() => handleDelete('resources', res.id)}>Delete</Button>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-surface-container-highest">
                <h3 className="text-sm font-bold text-on-surface-variant">Total Users</h3>
                <p className="text-3xl font-black text-primary-accent">{data.users.length}</p>
              </Card>
              <Card className="bg-surface-container-highest">
                <h3 className="text-sm font-bold text-on-surface-variant">Total Posts</h3>
                <p className="text-3xl font-black text-primary-accent">{data.posts.length}</p>
              </Card>
              <Card className="bg-surface-container-highest">
                <h3 className="text-sm font-bold text-on-surface-variant">Total Resources</h3>
                <p className="text-3xl font-black text-primary-accent">{data.resources.length}</p>
              </Card>
            </div>
          )}
        </Card>
      )}
    </motion.main>
  );
}

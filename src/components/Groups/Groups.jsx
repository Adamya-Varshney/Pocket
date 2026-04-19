import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Users, Plus, ChevronRight, Clock } from 'lucide-react';
import Card from '../UI/Card';
import './Groups.css';

const Groups = ({ user, onOpenGroup }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const fetchGroups = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch groups where user is a member
      const { data: memberRows, error: memberErr } = await supabase
        .from('expense_group_members')
        .select('group_id, role, expense_groups(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (memberErr) throw memberErr;
      
      const mappedGroups = memberRows.map(r => ({
        ...r.expense_groups,
        myRole: r.role
      }));
      setGroups(mappedGroups);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    
    if(!user) return;
    const channel = supabase.channel('groups-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_group_members', filter: `user_id=eq.${user.id}` }, fetchGroups)
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || !user) return;

    try {
      const groupId = crypto.randomUUID();

      // 1. Create the group (bypass .select() to avoid RLS read-rejection trap)
      const { error: groupErr } = await supabase
        .from('expense_groups')
        .insert({ id: groupId, name: newGroupName.trim(), created_by: user.id });
        
      if (groupErr) throw groupErr;

      // 2. Add creator as owner
      const creatorName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Unknown';
      const { error: memberErr } = await supabase
        .from('expense_group_members')
        .insert({ 
          group_id: groupId, 
          user_id: user.id, 
          role: 'owner',
          member_name: creatorName,
          member_email: user.email
        });

      if (memberErr) throw memberErr;

      setNewGroupName('');
      setShowCreate(false);
      fetchGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      alert(`Failed to create group:\n${error?.message || JSON.stringify(error)}`);
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text)', padding: '24px' }}>Loading groups...</div>;
  }

  return (
    <div className="groups-container animate-fade-in">
      <header className="groups-header">
        <div>
          <h1 className="groups-title">Shared Groups</h1>
          <p className="groups-subtitle">Manage shared expenses with friends and family</p>
        </div>
        <button className="create-group-btn" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} /> New Group
        </button>
      </header>

      {showCreate && (
        <Card className="create-group-card">
          <h3>Create a New Group</h3>
          <form className="create-group-form" onSubmit={handleCreateGroup}>
            <input 
              type="text" 
              placeholder="e.g. Goa Trip 2026, Apartment Setup..." 
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              autoFocus
            />
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={!newGroupName.trim()}>Create</button>
            </div>
          </form>
        </Card>
      )}

      {groups.length === 0 && !showCreate ? (
        <div className="empty-groups">
          <Users size={48} className="empty-icon" />
          <h3>No Groups Yet</h3>
          <p>Create a group to start tracking shared expenses.</p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>Create First Group</button>
        </div>
      ) : (
        <div className="groups-list">
          {groups.map(group => (
            <Card key={group.id} className="group-card clickable" onClick={() => onOpenGroup(group)}>
              <div className="group-card-header">
                <div className="group-icon"><Users size={20} /></div>
                <div className="group-details">
                  <h3>{group.name}</h3>
                  <span className="group-meta">
                    <Clock size={12} /> {new Date(group.created_at).toLocaleDateString()}
                    <span className={`role-badge ${group.myRole}`}>{group.myRole}</span>
                  </span>
                </div>
                <ChevronRight className="group-chevron" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Groups;

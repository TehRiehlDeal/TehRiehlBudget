import { useEffect, useState } from 'react';
import { useCategoriesStore, type Category } from '@/stores/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

function CategoryForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Category>;
  onSubmit: (data: Partial<Category>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [color, setColor] = useState(initial?.color || '#6b7280');
  const [icon, setIcon] = useState(initial?.icon || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({ name, color, icon: icon || undefined });
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground">Color</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
      </div>
      <Input placeholder="Icon name (optional)" value={icon} onChange={(e) => setIcon(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>{initial ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  );
}

export function Categories() {
  const { categories, loading, fetchCategories, createCategory, updateCategory, deleteCategory } = useCategoriesStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreate = async (data: Partial<Category>) => {
    await createCategory(data);
    setDialogOpen(false);
  };

  const handleUpdate = async (data: Partial<Category>) => {
    if (editing) {
      await updateCategory(editing.id, data);
      setEditing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 size-4" /> Add Category</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
            <CategoryForm onSubmit={handleCreate} onCancel={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {loading && categories.length === 0 ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : categories.length === 0 ? (
        <p className="text-muted-foreground">No categories yet. Add one to organize your transactions.</p>
      ) : (
        <Card>
          <CardHeader><CardTitle>All Categories</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between rounded-md border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="size-4 rounded-full" style={{ backgroundColor: cat.color || '#6b7280' }} />
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(cat)}>
                      <Pencil className="size-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteCategory(cat.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
          {editing && (
            <CategoryForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

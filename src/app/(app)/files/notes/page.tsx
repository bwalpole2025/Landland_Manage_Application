import { PageHeader, EmptyState, Button } from "@/components/ui";

export default function NotesPage() {
  return (
    <>
      <PageHeader
        title="Notes"
        description="Keep notes against a property or tenant — repairs, conversations, agreements."
        actions={<Button>Add note</Button>}
      />
      <EmptyState
        title="No notes yet"
        description="Add your first note to keep a record against a property or tenant."
        action={<Button>Add note</Button>}
      />
    </>
  );
}

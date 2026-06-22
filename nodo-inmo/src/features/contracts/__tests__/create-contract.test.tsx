/**
 * TDD — Create contract form
 * Tests:
 *   - renders property + tenant selects and rent input
 *   - blocks submit when required fields are empty
 *   - on valid submit calls mutateAsync with entered values + guarantor_ids
 *   - calls onSuccess after a successful insert
 *
 * Radix Select is mocked with a native <select> (jsdom has no Pointer Events).
 * Guarantor selection uses native checkboxes, which work directly in jsdom.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    schema: vi.fn(() => ({ from: vi.fn(() => ({ insert: vi.fn() })) })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn(), id: "s1" } },
      }),
    },
  },
}));

vi.mock("@nodocore/shared-components", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nodocore/shared-components")>();
  return {
    ...actual,
    useAuth: () => ({
      user: { email: "admin@nodo.com" },
      role: "admin",
      orgId: "org-abc",
      signOut: vi.fn(),
      session: {},
      loading: false,
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    // Native <select> mock for Radix Select (jsdom has no Pointer Events)
    Select: ({ children, onValueChange, value }: {
      children: React.ReactNode;
      onValueChange?: (v: string) => void;
      value?: string;
    }) => (
      <select value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)}>
        {children}
      </select>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectValue: (_props: { placeholder?: string }) => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      // Mirror Radix's contract: an empty-string item value crashes at runtime.
      if (value === "") {
        throw new Error(
          'A <SelectItem /> must have a value prop that is not an empty string.',
        );
      }
      return <option value={value}>{children}</option>;
    },
  };
});

// Property + contact option sources
vi.mock("@/features/properties/hooks/use-properties", () => ({
  PROPERTIES_QUERY_KEY: ["nodo_inmo", "properties"],
  useProperties: () => ({
    data: [
      {
        id: "prop-1",
        address: "Lavalle 100",
        operation: "rent",
        commission_rate: null,
        owner: { id: "owner-1", name: "Propietario Test", commission_rate: 8 },
      },
    ],
    isLoading: false,
    isFetching: false,
    isError: false,
  }),
}));

vi.mock("@/features/contacts/hooks/use-contacts", () => ({
  CONTACTS_QUERY_KEY: ["nodo_inmo", "contacts"],
  useContacts: (role?: string) => ({
    data:
      role === "tenant"
        ? [{ id: "tenant-1", name: "Juan Pérez" }]
        : role === "guarantor"
          ? [{ id: "guar-1", name: "Ana García" }]
          : role === "owner"
            ? [{ id: "owner-1", name: "Propietario Test" }]
            : [],
    isLoading: false,
    isFetching: false,
    isError: false,
  }),
}));

const mockMutateAsync = vi.fn();
vi.mock("@/features/contracts/hooks/use-create-contract", () => ({
  useCreateContract: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

import { CreateContractDialog } from "@/features/contracts/components/create-contract-dialog";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderDialog(onSuccess = vi.fn()) {
  return render(
    <CreateContractDialog open onOpenChange={vi.fn()} onSuccess={onSuccess} />,
    { wrapper },
  );
}

describe("CreateContractDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders property, tenant selects and rent input", () => {
    renderDialog();
    expect(screen.getByLabelText(/alquiler/i)).toBeInTheDocument();
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it("renders guarantor checkboxes from contacts with the guarantor role", () => {
    renderDialog();
    expect(screen.getByLabelText(/ana garcía/i)).toBeInTheDocument();
  });

  it("blocks submit and shows a validation error when required fields are empty", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => {
      expect(screen.getByText(/seleccioná una propiedad/i)).toBeInTheDocument();
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("calls mutateAsync with values and selected guarantor_ids on valid submit", async () => {
    mockMutateAsync.mockResolvedValue({ id: "new-c" });
    renderDialog();

    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0], "prop-1"); // property
    await userEvent.selectOptions(selects[1], "tenant-1"); // tenant
    await userEvent.type(screen.getByLabelText(/inicio/i), "2026-01-01");
    await userEvent.type(screen.getByLabelText(/^fin$/i), "2028-01-01");
    await userEvent.type(screen.getByLabelText(/alquiler/i), "250000");
    await userEvent.click(screen.getByLabelText(/ana garcía/i)); // guarantor

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledOnce());

    const payload = mockMutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      property_id: "prop-1",
      tenant_id: "tenant-1",
      start_date: "2026-01-01",
      end_date: "2028-01-01",
      rent_amount: 250000,
      commission_amount: 20000,
      guarantor_ids: ["guar-1"],
    });
  });

  it("auto-fills administración inmobiliaria from the property owner when a property is selected", async () => {
    renderDialog();

    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0], "prop-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/adm\.\s*inmobiliaria/i)).toHaveValue("8");
    });
  });

  it("shows the property owner in the propietario field", async () => {
    renderDialog();

    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0], "prop-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/^propietario$/i)).toHaveValue("Propietario Test");
    });
  });

  it("calls onSuccess after a successful submit", async () => {
    mockMutateAsync.mockResolvedValue({ id: "new-c" });
    const onSuccess = vi.fn();
    renderDialog(onSuccess);

    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0], "prop-1");
    await userEvent.selectOptions(selects[1], "tenant-1");
    await userEvent.type(screen.getByLabelText(/inicio/i), "2026-01-01");
    await userEvent.type(screen.getByLabelText(/^fin$/i), "2028-01-01");
    await userEvent.type(screen.getByLabelText(/alquiler/i), "180000");

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });
});

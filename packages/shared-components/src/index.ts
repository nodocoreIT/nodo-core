// ─── Lib ─────────────────────────────────────────────────────────────────────
export { cn, foldForSearch } from "./lib/utils";
export {
  normalizeDocumentDigits,
  formatDocumentThousands,
  formatCuitInput,
  formatDocumentNumberInput,
  resolveDocumentFormat,
  type DocumentNumberFormat,
} from "./lib/document-number";
export {
  userHasNodeAccess,
  enforceNodeAccess,
  INVALID_LOGIN_MESSAGE,
  ACCESS_DENIED_MESSAGE,
  AUTH_ERROR_CREDENTIALS,
  nodeLoginUrlWithAuthError,
} from "./lib/verify-node-access";
export {
  createNodoAuthClient,
  nodoAuthStorageKey,
} from "./lib/create-nodo-auth-client";

// ─── Providers ───────────────────────────────────────────────────────────────
export { SupabaseProvider, useSupabase } from "./providers/supabase-provider";
export {
  AuthProvider,
  useAuth,
  type AuthConfig,
  type AuthContextValue,
} from "./providers/auth-provider";

// ─── Components ──────────────────────────────────────────────────────────────
export { BrandMark, type BrandMarkProps } from "./components/brand-mark";
export { SearchInput, type SearchInputProps } from "./components/search-input";
export { GlobalSearchInput, type GlobalSearchInputProps } from "./components/global-search-input";
export {
  PortalHeaderActions,
  PortalHeaderMobileActions,
  type PortalHeaderActionsProps,
} from "./components/portal-header-actions";
export {
  NotificationBellButton,
  type NotificationBellButtonProps,
} from "./components/notification-bell-button";
export {
  NotificationBellBadge,
  type NotificationBellBadgeProps,
} from "./components/notification-bell-badge";
export {
  PasswordResetPanel,
  type PasswordResetPanelProps,
} from "./components/password-reset-panel";
export { usePasswordRecoveryBootstrap, isRecoveryHash } from "./hooks/use-password-recovery-bootstrap";
export { useFixedDocumentTitle } from "./hooks/use-fixed-document-title";
export { PlanGate, type PlanTier } from "./components/plan-gate";
export { RequireAuth } from "./components/require-auth";

// ─── UI primitives ───────────────────────────────────────────────────────────
export { Button, buttonVariants, type ButtonProps } from "./components/ui/button";
export { Input, type InputProps } from "./components/ui/input";
export {
  DocumentNumberInput,
  type DocumentNumberInputProps,
} from "./components/document-number-input";
export { Label } from "./components/ui/label";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/ui/card";
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./components/ui/table";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/ui/select";
export { Textarea } from "./components/ui/textarea";
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./components/ui/alert-dialog";
export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
} from "./components/ui/form";
export { PaginationControls } from "./components/ui/pagination";
export { Combobox } from "./components/ui/combobox";
export {
  FormSelect,
  EMPTY_SELECT_VALUE,
  type FormSelectOption,
  type FormSelectProps,
} from "./components/ui/form-select";
export {
  SearchableSelect,
  type SearchableSelectProps,
} from "./components/ui/searchable-select";

// ─── Hooks ───────────────────────────────────────────────────────────────────
export {
  useThemeSettings,
  useThemeStore,
  configureThemeDefaults,
  DEFAULT_SETTINGS,
  type ThemeSettings,
} from "./hooks/use-theme-settings";
export { useUIStore } from "./hooks/use-ui-store";
export { useSearchStore } from "./hooks/use-search-store";

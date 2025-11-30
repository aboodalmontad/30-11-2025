
import * as React from 'react';
import { ClipboardDocumentCheckIcon, ClipboardDocumentIcon, ServerIcon, ShieldCheckIcon, ExclamationTriangleIcon } from './icons';

// Helper component for copying text (Internal)
const CopyButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
    const [copied, setCopied] = React.useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button type="button" onClick={handleCopy} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm" title="نسخ الكود">
            {copied ? <ClipboardDocumentCheckIcon className="w-4 h-4 text-white" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
            {copied ? 'تم النسخ!' : 'نسخ كود SQL'}
        </button>
    );
};

const unifiedScript = `
-- =================================================================
-- السكربت الشامل لإصلاح وإعداد قاعدة البيانات مع نظام المساعدين وسجل المحذوفات
-- =================================================================

-- 1. تحديث جدول الملفات الشخصية (Profiles)
CREATE TABLE IF NOT EXISTS public.profiles (id uuid NOT NULL PRIMARY KEY);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS otp_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS otp_expires_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_start_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_end_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lawyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL; -- للمساعدين
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}'; -- صلاحيات المساعدين
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. الدوال والمشغلات (Functions & Triggers)

-- دالة مساعدة لتحديد "مالك البيانات"
CREATE OR REPLACE FUNCTION public.get_data_owner_id()
RETURNS uuid AS $$
DECLARE
    current_lawyer_id uuid;
BEGIN
    SELECT lawyer_id INTO current_lawyer_id FROM public.profiles WHERE id = auth.uid();
    IF current_lawyer_id IS NOT NULL THEN
        RETURN current_lawyer_id;
    ELSE
        RETURN auth.uid();
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- دالة للتحقق مما إذا كان المستخدم مديراً للنظام (Admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(user_role, 'user') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- دالة لحذف حساب المستخدم
CREATE OR REPLACE FUNCTION public.delete_user(user_id_to_delete uuid)
RETURNS void AS $$
BEGIN
    IF NOT public.is_admin() AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id_to_delete AND lawyer_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized to delete this user.';
    END IF;
    DELETE FROM auth.users WHERE id = user_id_to_delete;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
GRANT EXECUTE ON FUNCTION public.delete_user(uuid) TO authenticated;

-- دالة التحقق من الجوال
CREATE OR REPLACE FUNCTION public.check_if_mobile_exists(mobile_to_check text)
RETURNS boolean AS $$
DECLARE
    mobile_exists boolean;
BEGIN
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE mobile_number = mobile_to_check) INTO mobile_exists;
    RETURN mobile_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION public.check_if_mobile_exists(text) TO anon, authenticated;

-- دالة توليد OTP
CREATE OR REPLACE FUNCTION public.generate_mobile_otp(target_user_id uuid)
RETURNS text AS $$
DECLARE
    new_otp text;
BEGIN
    new_otp := floor(random() * (999999 - 100000 + 1) + 100000)::text;
    UPDATE public.profiles SET otp_code = new_otp, otp_expires_at = NULL WHERE id = target_user_id;
    RETURN new_otp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION public.generate_mobile_otp(uuid) TO anon, authenticated;

-- دالة التحقق من OTP
CREATE OR REPLACE FUNCTION public.verify_mobile_otp(target_mobile text, code_to_check text)
RETURNS boolean AS $$
DECLARE
    profile_record record;
BEGIN
    SELECT * INTO profile_record FROM public.profiles WHERE mobile_number = target_mobile;
    IF profile_record IS NULL OR profile_record.otp_code IS NULL THEN RAISE EXCEPTION 'Invalid request.'; END IF;
    IF profile_record.otp_code = code_to_check THEN
        UPDATE public.profiles SET mobile_verified = true, otp_code = null WHERE id = profile_record.id;
        RETURN true;
    ELSE
        RETURN false;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION public.verify_mobile_otp(text, text) TO anon, authenticated;

-- دالة التعامل مع المستخدم الجديد
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    raw_mobile TEXT;
    normalized_mobile TEXT;
    lawyer_mobile TEXT;
    normalized_lawyer_mobile TEXT;
    found_lawyer_id UUID;
BEGIN
    raw_mobile := new.raw_user_meta_data->>'mobile_number';
    IF raw_mobile IS NOT NULL AND raw_mobile != '' THEN
        normalized_mobile := '0' || RIGHT(regexp_replace(raw_mobile, '\\D', '', 'g'), 9);
    ELSE
        normalized_mobile := '0' || regexp_replace(new.email, '^sy963|@email\\.com$', '', 'g');
    END IF;

    lawyer_mobile := new.raw_user_meta_data->>'lawyer_mobile_number';
    found_lawyer_id := NULL;
    
    IF lawyer_mobile IS NOT NULL AND lawyer_mobile != '' THEN
        normalized_lawyer_mobile := '0' || RIGHT(regexp_replace(lawyer_mobile, '\\D', '', 'g'), 9);
        SELECT id INTO found_lawyer_id FROM public.profiles WHERE mobile_number = normalized_lawyer_mobile LIMIT 1;
    END IF;

    INSERT INTO public.profiles (
        id, full_name, mobile_number, created_at, mobile_verified, lawyer_id, is_approved
    )
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', 'مستخدم'),
      normalized_mobile,
      new.created_at,
      false,
      found_lawyer_id,
      CASE WHEN found_lawyer_id IS NOT NULL THEN false ELSE false END
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      mobile_number = EXCLUDED.mobile_number,
      lawyer_id = EXCLUDED.lawyer_id;

    UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = new.id;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. إنشاء الجداول
CREATE TABLE IF NOT EXISTS public.assistants (id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, user_id uuid NOT NULL, name text NOT NULL);
CREATE TABLE IF NOT EXISTS public.clients (id text NOT NULL PRIMARY KEY, user_id uuid NOT NULL, name text NOT NULL, contact_info text, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.cases (id text NOT NULL PRIMARY KEY, user_id uuid NOT NULL, client_id text NOT NULL, subject text NOT NULL, client_name text, opponent_name text, fee_agreement text, status text DEFAULT 'active', updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.stages (id text NOT NULL PRIMARY KEY, user_id uuid NOT NULL, case_id text NOT NULL, court text NOT NULL, case_number text, first_session_date timestamptz, decision_date timestamptz, decision_number text, decision_summary text, decision_notes text, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.sessions (id text NOT NULL PRIMARY KEY, user_id uuid NOT NULL, stage_id text NOT NULL, court text, case_number text, date timestamptz NOT NULL, client_name text, opponent_name text, postponement_reason text, next_postponement_reason text, is_postponed boolean DEFAULT false, next_session_date timestamptz, assignee text, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.admin_tasks (id text NOT NULL PRIMARY KEY, user_id uuid NOT NULL, task text NOT NULL, due_date timestamptz NOT NULL, completed boolean DEFAULT false, importance text DEFAULT 'normal', assignee text, location text, order_index integer, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.appointments (id text NOT NULL PRIMARY KEY, user_id uuid NOT NULL, title text NOT NULL, "time" text, date timestamptz NOT NULL, importance text, notified boolean, reminder_time_in_minutes integer, assignee text, completed boolean DEFAULT false, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.accounting_entries (id text NOT NULL PRIMARY KEY, user_id uuid NOT NULL, type text NOT NULL, amount real NOT NULL, date timestamptz NOT NULL, description text, client_id text, case_id text, client_name text, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.invoices (id text NOT NULL PRIMARY KEY, user_id uuid NOT NULL, client_id text NOT NULL, client_name text, case_id text, case_subject text, issue_date timestamptz NOT NULL, due_date timestamptz NOT NULL, tax_rate real DEFAULT 0, discount real DEFAULT 0, status text DEFAULT 'draft', notes text, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.invoice_items (id text NOT NULL PRIMARY KEY, user_id uuid NOT NULL, invoice_id text NOT NULL, description text NOT NULL, amount real NOT NULL, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.site_finances (id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, user_id uuid, type text DEFAULT 'income', payment_date date NOT NULL, amount real NOT NULL, description text, payment_method text, category text, profile_full_name text, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.case_documents (id text NOT NULL PRIMARY KEY, user_id uuid NOT NULL, case_id text NOT NULL, name text NOT NULL, type text NOT NULL, size real NOT NULL, added_at timestamptz DEFAULT now() NOT NULL, storage_path text, updated_at timestamptz DEFAULT now());

-- جدول سجل المحذوفات
CREATE TABLE IF NOT EXISTS public.sync_deletions (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    table_name text NOT NULL,
    record_id text NOT NULL,
    user_id uuid NOT NULL,
    deleted_at timestamptz DEFAULT now()
);

-- 4. سياسات الأمان (RLS)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT 'DROP POLICY IF EXISTS "' || policyname || '" ON public.' || tablename || ';' as statement FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE r.statement;
    END LOOP;
END$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles Visibility" ON public.profiles FOR SELECT USING (auth.uid() = id OR lawyer_id = auth.uid() OR public.is_admin());
CREATE POLICY "Profiles Update" ON public.profiles FOR UPDATE USING (auth.uid() = id OR lawyer_id = auth.uid() OR public.is_admin());

-- تحديث السياسات للسماح للمدير برؤية جميع البيانات
CREATE POLICY "Access Own Data" ON public.assistants FOR ALL USING (user_id = public.get_data_owner_id() OR public.is_admin());
CREATE POLICY "Access Own Data" ON public.clients FOR ALL USING (user_id = public.get_data_owner_id() OR public.is_admin());
CREATE POLICY "Access Own Data" ON public.cases FOR ALL USING (user_id = public.get_data_owner_id() OR public.is_admin());
CREATE POLICY "Access Own Data" ON public.stages FOR ALL USING (user_id = public.get_data_owner_id() OR public.is_admin());
CREATE POLICY "Access Own Data" ON public.sessions FOR ALL USING (user_id = public.get_data_owner_id() OR public.is_admin());
CREATE POLICY "Access Own Data" ON public.admin_tasks FOR ALL USING (user_id = public.get_data_owner_id() OR public.is_admin());
CREATE POLICY "Access Own Data" ON public.appointments FOR ALL USING (user_id = public.get_data_owner_id() OR public.is_admin());
CREATE POLICY "Access Own Data" ON public.accounting_entries FOR ALL USING (user_id = public.get_data_owner_id() OR public.is_admin());
CREATE POLICY "Access Own Data" ON public.invoices FOR ALL USING (user_id = public.get_data_owner_id() OR public.is_admin());
CREATE POLICY "Access Own Data" ON public.invoice_items FOR ALL USING (user_id = public.get_data_owner_id() OR public.is_admin());
CREATE POLICY "Access Own Data" ON public.case_documents FOR ALL USING (user_id = public.get_data_owner_id() OR public.is_admin());

-- سياسة سجل المحذوفات
ALTER TABLE public.sync_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access Own Deletions" ON public.sync_deletions FOR ALL USING (user_id = public.get_data_owner_id() OR public.is_admin());

ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.site_finances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage finances" ON public.site_finances FOR ALL USING (public.is_admin());

-- 5. تفعيل Realtime
DO $$
DECLARE
    t text;
    target_tables text[] := ARRAY[
        'public.profiles', 'public.clients', 'public.cases', 
        'public.stages', 'public.sessions', 'public.admin_tasks', 
        'public.appointments', 'public.accounting_entries', 
        'public.assistants', 'public.invoices', 'public.invoice_items', 
        'public.site_finances', 'public.case_documents', 'public.sync_deletions'
    ];
BEGIN
    FOR t IN SELECT unnest(target_tables) LOOP
        BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE ' || t; EXCEPTION WHEN duplicate_object THEN NULL; END;
    END LOOP;
END $$;

-- 6. Storage Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- 7. Backfill
INSERT INTO public.profiles (id, full_name, mobile_number, role, is_approved, is_active, mobile_verified)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'full_name', 'مستخدم'),
    COALESCE(au.raw_user_meta_data->>'mobile_number', ''),
    'admin', true, true, true
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.profiles);
`;

interface ConfigurationModalProps {
    onRetry: () => void;
}

const ConfigurationModal: React.FC<ConfigurationModalProps> = ({ onRetry }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[200]">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center gap-3 mb-4 text-amber-600">
                    <ServerIcon className="w-8 h-8" />
                    <h2 className="text-2xl font-bold">تحديث قاعدة البيانات (إصلاح المزامنة والصلاحيات)</h2>
                </div>
                
                <div className="overflow-y-auto flex-grow pr-2">
                    <div className="bg-blue-50 border-s-4 border-blue-500 p-4 mb-4 rounded">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <ExclamationTriangleIcon className="h-5 w-5 text-blue-400" aria-hidden="true" />
                            </div>
                            <div className="ms-3">
                                <p className="text-sm text-blue-700">
                                    هذا التحديث ضروري لإصلاح مشكلة عرض إحصائيات المستخدمين للمدير وعودة البيانات المحذوفة. يرجى نسخ الكود الجديد وتشغيله في Supabase.
                                </p>
                            </div>
                        </div>
                    </div>

                    <ol className="list-decimal list-inside space-y-4 text-sm text-gray-600 mb-6">
                        <li className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                                <strong className="text-gray-900">انسخ كود SQL:</strong>
                                <CopyButton textToCopy={unifiedScript} />
                            </div>
                            <div className="relative">
                                <pre className="bg-gray-800 text-green-400 p-3 rounded border border-gray-700 overflow-x-auto text-xs font-mono h-32" dir="ltr">
                                    {unifiedScript}
                                </pre>
                            </div>
                        </li>
                        <li>اذهب إلى <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">SQL Editor في Supabase</a>.</li>
                        <li>الصق الكود واضغط <strong>Run</strong>.</li>
                        <li>بعد النجاح، عد إلى هنا واضغط "إعادة المحاولة".</li>
                    </ol>
                </div>

                <div className="mt-6 flex justify-end pt-4 border-t">
                    <button onClick={onRetry} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md">إعادة المحاولة</button>
                </div>
            </div>
        </div>
    );
};

export default ConfigurationModal;

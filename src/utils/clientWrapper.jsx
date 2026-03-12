'use client';
import PageGuard from "@/app/components/PageGuard";

export default function ClientWrapper({ children }) {

    return (
        <PageGuard condition="isUnauthenticated" redirectPath='/login'>
            {children}
        </PageGuard>
    );
}

"use client";

import PageGuard from "../components/PageGuard";

export default function LoginLayout({ children }) {

    return (
        <PageGuard condition='isAuthenticated' redirectPath='/'>
                {children}
        </PageGuard>

    );
}
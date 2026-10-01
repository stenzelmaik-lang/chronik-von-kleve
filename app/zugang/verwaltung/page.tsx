import { redirect } from "next/navigation";
import { currentUserFromContext } from "@/server/platform-auth";
import AccessManagement from "./access-ui";
export default async function AccessPage(){if(!await currentUserFromContext())redirect('/anmelden');return <AccessManagement/>;}

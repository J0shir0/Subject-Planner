// src/services/cassandraClient.ts
import { Client } from "cassandra-driver";
import { appConfig } from "../config/app";

let cassandraOnline = false;

export const cassandraClient = new Client({
    contactPoints: appConfig.cassandra.contactPoints,
    localDataCenter: appConfig.cassandra.datacenter,
    keyspace: appConfig.cassandra.keyspace,
    protocolOptions: { port: appConfig.cassandra.port },
    credentials: appConfig.cassandra.username
        ? {
            username: appConfig.cassandra.username,
            password: appConfig.cassandra.password,
        }
        : undefined,
});

export async function connectCassandra(): Promise<void> {
    try {
        await cassandraClient.connect();
        cassandraOnline = true;
        console.log(
            `[Cassandra] ✅ Connected to ${appConfig.cassandra.contactPoints.join(", ")} (ks=${
                appConfig.cassandra.keyspace
            })`
        );
    } catch (err: any) {
        cassandraOnline = false;
        console.warn("[Cassandra] ⚠️ Could not connect:", err.message || err);
    }
}

export function isCassandraAvailable(): boolean {
    return cassandraOnline;
}

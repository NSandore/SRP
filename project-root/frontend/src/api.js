const API_URL = "/api";

export async function fetchTestMessage() {
    const response = await fetch(`${API_URL}/test`);
    if (!response.ok) {
        throw new Error("Failed to fetch data");
    }
    return response.json();
}

# Network boundary

Local files are converted inside the browser and their names and contents are not sent to Clyvora. The app loads its interface, conversion runtime, and cookie-free page analytics from its own origin.

Only after a user chooses **Paste link**, a direct HTTPS URL contacts that source host. For a SoundCloud link, the pasted URL is sent to the configured resolver and media is then downloaded from the source host; local files are never included. The page does not preconnect to these services.

The production Content Security Policy blocks framing and limits other browser capabilities. Any new automatic outbound connection requires a documented review and an update to this file.

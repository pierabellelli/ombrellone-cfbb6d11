Risolverò i due problemi segnalati senza cambiare la logica dati già creata.

1. **Accesso dashboard**
   - Correggo il mismatch di idratazione aggiungendo `suppressHydrationWarning` su `<html>` e `<body>` nel layout root.
   - Mantengo il link “Accedi alla dashboard” verso `/login`, che esiste già.

2. **Accesso cliente dalla home**
   - Aggiungo nella home un pulsante visibile “Vedi area cliente demo” che apre `/lido/demo?o=12`.
   - Aggiungo anche un link “Traccia ordine demo” verso `/traccia/demo`, così il cliente può provare il tracciamento.

3. **Verifica**
   - Controllo che dalla home i link portino correttamente a `/login`, `/lido/demo?o=12` e `/traccia/demo` senza finire in 404.
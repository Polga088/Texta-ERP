# Cadre de conformité ISO (adaptation Texta)

Ce document définit une base pragmatique pour aligner la plateforme avec les pratiques attendues par les référentiels ISO, sans sur-ingénierie.

## Référentiels ciblés

- **ISO 9001** (qualité processus, amélioration continue)
- **ISO 27001** (sécurité de l'information, contrôle des accès, journalisation)
- **ISO 27002** (bonnes pratiques opérationnelles)

## Contrôles déjà couverts (V1)

- Contrôle d'accès RBAC (`PermissionEngine`, grants projet)
- Journal d'audit (`audit_logs`) pour actions sensibles
- Validation des entrées côté API (Pydantic)
- Segmentation par `organization_id` sur les entités métier

## Contrôles à renforcer (roadmap rapide)

1. **Gestion des mots de passe**
   - Politique de complexité et rotation admin
   - Limitation tentatives login (rate limiting)
2. **Traçabilité complète**
   - Journaliser create/update/delete des modules critiques (leads, RH, time, grants)
3. **Sécurité applicative**
   - Headers sécurité (CSP, HSTS en HTTPS)
   - Revue permissions par endpoint (principe du moindre privilège)
4. **Processus qualité projet**
   - Fiche projet obligatoire: `company_name`, `project_code`, `quality_standard`, `scope_statement`
5. **Continuité**
   - Sauvegardes automatisées PostgreSQL + test de restauration mensuel

## Données RH et confidentialité

- Limiter l'affichage des données RH aux rôles `admin` et `hr_manager`
- Conserver un historique des demandes de congés/sorties
- Prévoir purge/archivage selon politique de rétention

## KPI gouvernance recommandés

- Taux de couverture des audits (actions loggées / actions critiques)
- Temps moyen de traitement des demandes RH
- Temps moyen passé par projet (time tracking)
- Taux de conversion leads (`won` / total leads)

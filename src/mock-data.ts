export const mockIncidentXml = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<uk.co.nationalrail.xml.incident.PtIncidentStructure xmlns:ns2="http://nationalrail.co.uk/xml/common" xmlns:ns3="http://nationalrail.co.uk/xml/incident">
  <ns3:CreationTime>2017-04-24T17:22:00.000+01:00</ns3:CreationTime>
  <ns3:ChangeHistory>
    <ns2:ChangedBy>bives</ns2:ChangedBy>
    <ns2:LastChangedDate>2017-04-24T17:32:00.000+01:00</ns2:LastChangedDate>
  </ns3:ChangeHistory>
  <ns3:IncidentNumber>8B3B4C1F358A45A186F6F95984F52F4F</ns3:IncidentNumber>
  <ns3:Version>20170424173219</ns3:Version>
  <ns3:Source>
    <ns3:TwitterHashtag>#CrystalPalace</ns3:TwitterHashtag>
  </ns3:Source>
  <ns3:ValidityPeriod>
    <ns2:StartTime>2017-04-24T17:22:00.000+01:00</ns2:StartTime>
  </ns3:ValidityPeriod>
  <ns3:Planned>false</ns3:Planned>
  <ns3:Summary>Delays in the Crystal Palace area expected until 20:15</ns3:Summary>
  <ns3:Description>
    <p>Due to trespassers on the railway at Crystal Palace trains have to run at reduced speed on all lines.</p>
    <p><strong>Additional Information:</strong> Please keep your train ticket and make a note of your journey, as both will be required to support any claim.</p>
  </ns3:Description>
  <ns3:InfoLinks>
    <ns3:InfoLink>
      <ns3:Uri>http://www.nationalrail.co.uk/service_disruptions/162083.aspx</ns3:Uri>
      <ns3:Label>nationalrail.co.uk</ns3:Label>
    </ns3:InfoLink>
  </ns3:InfoLinks>
  <ns3:Affects>
    <ns3:Operators>
      <ns3:AffectedOperator>
        <ns3:OperatorRef>SN</ns3:OperatorRef>
        <ns3:OperatorName>Southern</ns3:OperatorName>
      </ns3:AffectedOperator>
    </ns3:Operators>
    <ns3:RoutesAffected>
      <p>Routes through Crystal Palace</p>
    </ns3:RoutesAffected>
  </ns3:Affects>
  <ns3:ClearedIncident>false</ns3:ClearedIncident>
  <ns3:IncidentPriority>2</ns3:IncidentPriority>
</uk.co.nationalrail.xml.incident.PtIncidentStructure>
`;

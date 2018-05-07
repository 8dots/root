'use strict';

angular.module('mean.icu.ui.entityDetails')
    .controller('EntityDocumentsController', function ($scope, entity, context, documents, AttachmentsService) {
        //$scope.project = entity || context.entity;
        
        $scope.documents = documents;
        $scope.documents.map(doc => AttachmentsService.getAttachmentUser(doc.creator).then(user =>
            doc.attUser = user.name 
        ))

    });
